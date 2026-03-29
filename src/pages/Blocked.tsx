import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Blocked() {
  const { session, blockReason, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  // Once session is cleared (after sign-out), go to login
  useEffect(() => {
    if (!session) {
      navigate('/admin/login', { replace: true })
    }
  }, [session, navigate])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    // navigation happens in the useEffect above once session clears
  }

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-red-400 text-4xl">block</span>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-white">Access Suspended</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            {blockReason ?? 'Your access has been suspended by the platform administrator.'}
          </p>
        </div>

        {/* Contact line */}
        <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
          If you believe this is a mistake, contact your platform administrator or the Rollcally support team for assistance.
        </p>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>

      </div>
    </div>
  )
}
