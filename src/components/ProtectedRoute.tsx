import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
    </div>
  )
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  
  const role = session?.user.user_metadata?.role
  const isAdmin = role === 'admin' || role === 'superadmin'

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}
