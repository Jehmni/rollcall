import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-background-dark">
      <div className="relative size-14">
        <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
        <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-2 flex items-center justify-center">
          <img src="/logo.png" alt="" className="size-7 object-contain opacity-80" />
        </div>
      </div>
      <p className="text-2xs font-bold uppercase tracking-spaced text-slate-600">Rollcally</p>
    </div>
  )
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, isBlocked, loading } = useAuth()
  if (loading) return <Spinner />

  if (!session) return <Navigate to="/admin/login" replace />
  if (isBlocked) return <Navigate to="/blocked" replace />
  return <>{children}</>
}

export function SuperRoute({ children }: { children: ReactNode }) {
  const { session, isSuper, loading } = useAuth()
  if (loading) return <Spinner />

  if (!session || !isSuper) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
