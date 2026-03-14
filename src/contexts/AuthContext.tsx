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
  adminUnits: UnitWithOrg[]
  loading: boolean
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
  const [adminUnits, setAdminUnits] = useState<UnitWithOrg[]>([])
  const [loading, setLoading] = useState(true)

  async function applySession(session: Session | null) {
    setSession(session)
    if (!session) {
      setIsSuper(false)
      setAdminUnits([])
      return
    }
    const role = session.user.user_metadata?.role as string | undefined
    const super_ = role === 'superadmin'
    setIsSuper(super_)
    if (!super_) {
      const units = await fetchAdminUnits(session.user.id)
      setAdminUnits(units)
    } else {
      setAdminUnits([])
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await applySession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
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
      adminUnits, 
      loading, 
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
