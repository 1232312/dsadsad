// supabase/functions/auth-callback/index.ts
//
// Exchanges a Firebase id token for a Supabase session.
//
// Flow:
//   1. Frontend signs in with Firebase (Google / GitHub / email).
//   2. Frontend POSTs the Firebase id token here.
//   3. We verify the token against Firebase's public JWKS.
//   4. We mint a Supabase custom JWT whose `sub` and `firebase_uid` claim
//      match the Firebase user. RLS on `projects` reads
//      `auth.jwt() ->> 'firebase_uid'` for ownership checks.
//   5. We return the access + refresh token pair so the frontend can call
//      supabase.auth.setSession() and start writing as that user.
//
// The Supabase service role key is available in the function env and is the
// only key that can mint JWTs the Supabase client will accept.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { crypto as webcrypto } from 'jsr:@std/crypto'
import { decodeBase64Url } from 'jsr:@std/encoding'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface FirebaseIdTokenHeader {
  kid: string
  alg: string
}
interface FirebaseIdTokenPayload {
  iss: string
  aud: string
  sub: string
  email: string | null
  name: string | null
  picture: string | null
  exp: number
  iat: number
  email_verified: boolean | undefined
  firebase: { identities?: Record<string, string[]>; sign_in_provider?: string } | undefined
}

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwksCache: { keys: Record<string, JsonWebKey>; fetchedAt: number } | null = null

async function fetchJwks(): Promise<Record<string, JsonWebKey>> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000) {
    return jwksCache.keys
  }
  const res = await fetch(FIREBASE_JWKS_URL)
  if (!res.ok) throw new Error(`Failed to fetch Firebase JWKS (${res.status})`)
  const jwks = (await res.json()) as Record<string, JsonWebKey>
  jwksCache = { keys: jwks, fetchedAt: Date.now() }
  return jwks
}

function decodeJwtPart(part: string): Record<string, unknown> {
  const json = new TextDecoder().decode(decodeBase64Url(part))
  return JSON.parse(json) as Record<string, unknown>
}

async function verifyFirebaseIdToken(token: string): Promise<FirebaseIdTokenPayload> {
  const [headerB64, payloadB64, signatureB64] = token.split('.')
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Malformed id token')
  }
  const header = decodeJwtPart(headerB64) as unknown as FirebaseIdTokenHeader
  const payload = decodeJwtPart(payloadB64) as unknown as FirebaseIdTokenPayload

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    throw new Error('id token expired')
  }
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID') ?? ''
  const expectedIssuer = `https://securetoken.google.com/${projectId}`
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Invalid issuer: ${payload.iss}`)
  }
  if (projectId && payload.aud !== projectId) {
    throw new Error(`Invalid audience: ${payload.aud}`)
  }

  const jwks = await fetchJwks()
  const key = jwks[header.kid]
  if (!key) throw new Error('Signing key not found in JWKS')

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = decodeBase64Url(signatureB64)
  // @ts-ignore: subtle.verify accepts BufferSource
  const ok = await webcrypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    await webcrypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']),
    signature,
    signedData,
  )
  if (!ok) throw new Error('Invalid signature')

  return payload
}

function b64url(input: string): string {
  // Base64url without padding, for JWT segment encoding.
  const b64 = btoa(input)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Mint a Supabase-compatible JWT. We sign with the service role key (HMAC-SHA256)
 * and inject `firebase_uid` into the payload so RLS can read it via
 * `auth.jwt() ->> 'firebase_uid'`.
 */
async function mintSupabaseJwt(payload: Record<string, unknown>): Promise<string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const header = { typ: 'JWT', alg: 'HS256' }
  const headerB64 = b64url(JSON.stringify(header))
  const payloadB64 = b64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const keyData = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await webcrypto.subtle.sign('HMAC', keyData, new TextEncoder().encode(signingInput)),
  )
  // Convert signature to base64url.
  let sigB64 = btoa(String.fromCharCode(...sig))
  sigB64 = sigB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${signingInput}.${sigB64}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const body = (await req.json().catch(() => ({}))) as { idToken?: string }
    if (!body.idToken) {
      return new Response(JSON.stringify({ error: 'idToken required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const verified = await verifyFirebaseIdToken(body.idToken)
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 60 * 60 // 1 hour
    const payload = {
      iss: `${Deno.env.get('SUPABASE_URL')}/auth/v1/`,
      sub: verified.sub,
      aud: 'authenticated',
      exp,
      iat: now,
      email: verified.email,
      role: 'authenticated',
      firebase_uid: verified.sub,
      name: verified.name,
      picture: verified.picture,
      app_metadata: { provider: 'firebase', providers: ['firebase'] },
      user_metadata: { name: verified.name, picture: verified.picture },
    }
    const access_token = await mintSupabaseJwt(payload)
    // Supabase refresh tokens are opaque server-issued secrets; we cannot mint
    // them from the edge. We return the access token and reuse it as the
    // refresh token so supabase.auth.setSession() accepts the pair. The client
    // will re-link on the next Firebase token refresh.
    const refresh_token = access_token

    return new Response(
      JSON.stringify({ access_token, refresh_token, user: { id: verified.sub, email: verified.email } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'auth-callback failed'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
