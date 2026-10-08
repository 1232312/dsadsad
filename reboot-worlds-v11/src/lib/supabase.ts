import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Supabase env vars missing. Check .env for VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.')
}

/**
 * Supabase client singleton.
 *
 * Auth is handled by Firebase (see src/lib/firebase.ts). The Supabase client is
 * used for project data storage. When a Firebase user signs in, their id token
 * is exchanged for a Supabase session via the `auth-callback` edge function,
 * which mints a custom JWT whose `sub` matches the `firebase_uid` column.
 */
export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'reboot-sb-session',
  },
})
