import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, UserAttributes, SignInWithPasswordCredentials, SignUpWithPasswordCredentials, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UnitWithOrg } from '../types'

interface AuthContextValue {
  session: Session | null
  isSuper: boolean
  isBlocked: boolean
  blockReason: string | null
  adminUnits: UnitWithOrg[]
  loading: boolean   // true only during the very first session hydration on mount
  checking: boolean  // true while async permission checks are in-flight after any sign-in
  signIn: (credentials: SignInWithPasswordCredentials) => Promise<{ error: AuthError | null }>
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (attributes: UserAttributes) => Promise<{ error: AuthError | null }>
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchAdminUnits(userId: string): Promise<UnitWithOrg[]> {
  const { data } = await supabase
    .from('unit_admins')
    .select('unit:units(id, org_id, name, description, created_at, organization:organizations(id, name, created_at))')
    .eq('user_id', userId)

  if (!data) return []
  return data.map(row => {
    const unit = row.unit as unknown as UnitWithOrg & { organization: UnitWithOrg['organization'] }
    return {
      ...unit,
      organization: unit.organization,
    }
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isSuper, setIsSuper] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [adminUnits, setAdminUnits] = useState<UnitWithOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  async function applySession(s: Session | null) {
    setSession(s)
    if (!s) {
      setIsSuper(false)
      setIsBlocked(false)
      setBlockReason(null)
      setAdminUnits([])
      setChecking(false)
      return
    }

    setChecking(true)
    try {
      // 1. Super admin check (security-definer table — never blocked)
      const { data: superRow } = await supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', s.user.id)
        .maybeSingle()

      if (superRow) {
        setIsSuper(true)
        setIsBlocked(false)
        setBlockReason(null)
        setAdminUnits([])
        return
      }
      setIsSuper(false)

      // 2. Individual block check
      const { data: blockedRow } = await supabase
        .from('blocked_admins')
        .select('reason')
        .eq('user_id', s.user.id)
        .maybeSingle()

      if (blockedRow) {
        setIsBlocked(true)
        setBlockReason(blockedRow.reason ?? 'Your account has been suspended by the platform administrator.')
        setAdminUnits([])
        return
      }

      // 3. Org-level block check — two separate queries to avoid PostgREST
      //    embedded-filter ambiguity (parent row is always returned, even when
      //    the join filter misses, so checking the parent alone is unreliable).
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('admin_id', s.user.id)

      if (memberships && memberships.length > 0) {
        const orgIds = memberships.map(m => m.organization_id as string)
        const { data: blockedOrgs } = await supabase
          .from('organizations')
          .select('id')
          .in('id', orgIds)
          .not('blocked_at', 'is', null)
          .limit(1)

        if (blockedOrgs && blockedOrgs.length > 0) {
          setIsBlocked(true)
          setBlockReason('Your organisation has been suspended by the platform administrator.')
          setAdminUnits([])
          return
        }
      }

      // 4. Normal admin — load units
      setIsBlocked(false)
      setBlockReason(null)
      const units = await fetchAdminUnits(s.user.id)
      setAdminUnits(units)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      await applySession(s)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(credentials: SignInWithPasswordCredentials) {
    const { error } = await supabase.auth.signInWithPassword(credentials)
    if (error) console.error('Supabase Auth Error:', error)
    return { error }
  }

  async function signUp(credentials: SignUpWithPasswordCredentials) {
    const { error } = await supabase.auth.signUp(credentials)
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/update-password`,
    })
    return { error }
  }

  async function updatePassword(attributes: UserAttributes) {
    const { error } = await supabase.auth.updateUser(attributes)
    return { error }
  }

  async function refreshPermissions() {
    if (!session) return
    const units = await fetchAdminUnits(session.user.id)
    setAdminUnits(units)
  }

  return (
    <AuthContext.Provider value={{
      session,
      isSuper,
      isBlocked,
      blockReason,
      adminUnits,
      loading,
      checking,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      refreshPermissions
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
