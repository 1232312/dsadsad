import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FbUser,
} from 'firebase/auth'
import { firebaseAuth, googleProvider, githubProvider } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import type { Project, NewProject } from '@/types/project'
import { rowToProject, type ProjectRow } from '@/types/project'

export type AuthProvider = 'google' | 'github' | 'email'

interface RebootUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

interface AuthState {
  user: RebootUser | null
  initializing: boolean
  error: string | null
  signIn: (provider: AuthProvider, email?: string, password?: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

function toRebootUser(u: FbUser): RebootUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  }
}

/**
 * Bridge a Firebase identity into Supabase. We store `firebase_uid` on each
 * project row and scope RLS by it. To let the anon-key client write, we mint a
 * lightweight Supabase session by calling the `auth-callback` edge function,
 * which verifies the Firebase id token and returns a custom JWT whose `sub`
 * matches the firebase uid. If the function is unavailable, the app still
 * works in read-only mode (RLS denies writes, reads remain public).
 */
async function linkSupabaseSession(idToken: string): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-callback`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) throw new Error(`Auth link failed (${res.status})`)
    const { access_token, refresh_token } = (await res.json()) as {
      access_token: string
      refresh_token: string
    }
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })
    if (error) throw error
  } catch (err) {
    // Non-fatal: app degrades to read-only for this session.
    console.warn('[auth] Supabase session link skipped:', err)
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  error: null,

  async signIn(provider, email, password) {
    set({ error: null })
    try {
      let fbUser: FbUser
      if (provider === 'google') {
        fbUser = (await signInWithPopup(firebaseAuth, googleProvider)).user
      } else if (provider === 'github') {
        fbUser = (await signInWithPopup(firebaseAuth, githubProvider)).user
      } else {
        if (!email || !password) throw new Error('Email and password required.')
        fbUser = (await signInWithEmailAndPassword(firebaseAuth, email, password)).user
      }
      const idToken = await fbUser.getIdToken()
      await linkSupabaseSession(idToken)
      set({ user: toRebootUser(fbUser) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.'
      set({ error: msg })
      throw err
    }
  },

  async signUp(email, password) {
    set({ error: null })
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      const idToken = await cred.user.getIdToken()
      await linkSupabaseSession(idToken)
      set({ user: toRebootUser(cred.user) })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed.'
      set({ error: msg })
      throw err
    }
  },

  async signOut() {
    await fbSignOut(firebaseAuth)
    await supabase.auth.signOut()
    set({ user: null })
  },

  clearError() {
    set({ error: null })
  },
}))

// One-time auth state bootstrap. Re-links the Supabase session whenever
// Firebase emits a new user / refreshed id token.
onAuthStateChanged(firebaseAuth, async (fbUser) => {
  if (fbUser) {
    try {
      const idToken = await fbUser.getIdToken()
      await linkSupabaseSession(idToken)
    } catch {
      /* read-only fallback */
    }
    useAuth.setState({ user: toRebootUser(fbUser), initializing: false })
  } else {
    useAuth.setState({ user: null, initializing: false })
  }
})

// ---- Project data access ----------------------------------------------- //
// Centralized so modules never import Supabase directly. Each module consumes
// `useProjects` and renders its own visualization; no module knows how any
// other module renders.

interface ProjectDataState {
  projects: Project[]
  loading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  createProject: (input: NewProject) => Promise<Project | null>
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>
}

function rowToInsert(input: NewProject) {
  return {
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    category: input.category,
    status: input.status,
    stage: input.stage,
    momentum: input.momentum,
    founder: input.founder,
    founded_year: input.foundedYear,
    failure_year: input.failureYear,
    failure_reason: input.failureReason,
    tags: input.tags,
    connections: input.connections,
    followers: input.followers,
  }
}

export const useProjects = create<ProjectDataState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  async fetchProjects() {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<ProjectRow[]>()

    if (error) {
      set({ loading: false, error: error.message })
      return
    }
    set({ projects: (data ?? []).map(rowToProject), loading: false })
  },

  async createProject(input) {
    const { data, error } = await supabase
      .from('projects')
      .insert(rowToInsert(input))
      .select('*')
      .single<ProjectRow>()

    if (error) {
      set({ error: error.message })
      return null
    }
    const project = rowToProject(data)
    set({ projects: [project, ...get().projects] })
    return project
  },

  async updateProject(id, patch) {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.tagline !== undefined) row.tagline = patch.tagline
    if (patch.description !== undefined) row.description = patch.description
    if (patch.category !== undefined) row.category = patch.category
    if (patch.status !== undefined) row.status = patch.status
    if (patch.stage !== undefined) row.stage = patch.stage
    if (patch.momentum !== undefined) row.momentum = patch.momentum
    if (patch.founder !== undefined) row.founder = patch.founder
    if (patch.foundedYear !== undefined) row.founded_year = patch.foundedYear
    if (patch.failureYear !== undefined) row.failure_year = patch.failureYear
    if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason
    if (patch.tags !== undefined) row.tags = patch.tags
    if (patch.connections !== undefined) row.connections = patch.connections
    if (patch.followers !== undefined) row.followers = patch.followers

    const { data, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select('*')
      .single<ProjectRow>()

    if (error) {
      set({ error: error.message })
      return
    }
    const updated = rowToProject(data)
    set({
      projects: get().projects.map((p) => (p.id === id ? updated : p)),
    })
  },
}))
