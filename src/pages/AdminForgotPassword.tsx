import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminForgotPassword() {
  const navigate = useNavigate()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: resetError } = await resetPassword(email.trim().toLowerCase())
    
    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased relative overflow-hidden">
      {/* Visual Decoration Elements */}
      <div className="fixed top-0 right-0 -z-10 opacity-20 pointer-events-none">
        <div className="w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full"></div>
      </div>
      <div className="fixed bottom-0 left-0 -z-10 opacity-10 pointer-events-none">
        <div className="w-[300px] h-[300px] bg-primary/30 blur-[100px] rounded-full"></div>
      </div>

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between p-4 bg-background-dark/80 backdrop-blur-md sticky top-0 z-50 border-b border-primary/10">
        <button 
          onClick={() => navigate('/admin/login')}
          className="flex items-center text-slate-300 transition-all hover:text-primary group"
        >
          <span className="material-symbols-outlined mr-1 group-hover:-translate-x-1 transition-transform">chevron_left</span>
          <span className="text-sm font-bold uppercase tracking-wider">sign in</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(82,71,230,0.2)]">
            <span className="material-symbols-outlined text-primary text-xl">shield_person</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-12 pb-20 max-w-md mx-auto w-full relative z-10">
        {success ? (
          <div className="animate-in fade-in zoom-in-95 duration-700 h-full flex flex-col items-center">
            {/* Icon Illustration */}
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
              <div className="relative w-24 h-24 bg-primary/10 border border-primary/30 rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-5xl">mark_email_read</span>
              </div>
            </div>

            {/* Content */}
            <div className="text-center space-y-4 mb-10">
              <h1 className="text-3xl font-bold text-white tracking-tight uppercase italic">Check Your Inbox</h1>
              <div className="space-y-4 text-slate-400">
                <p className="text-lg leading-relaxed font-medium">
                  We have sent a password reset link to <br/>
                  <span className="text-primary font-black break-all">{email}</span>.
                </p>
                <p className="text-sm font-bold uppercase tracking-wider opacity-60">
                  Please click the link in that email to choose a new password. If you don’t see it within a few minutes, please check your spam folder.
                </p>
              </div>
            </div>

            {/* Action Area */}
            <div className="w-full space-y-4">
              <button 
                onClick={() => window.open('mailto:', '_blank')}
                className="w-full py-5 bg-primary hover:bg-primary/90 text-white font-black rounded-[2rem] shadow-2xl shadow-primary/40 transition-all active:scale-[0.98] uppercase tracking-spread text-xs"
              >
                Open Email App
              </button>
              <button 
                onClick={() => navigate('/admin/login')}
                className="w-full py-5 bg-transparent border border-primary/20 text-white font-black rounded-[2rem] hover:bg-primary/10 transition-all active:scale-[0.98] uppercase tracking-spread text-xs"
              >
                Back to Login
              </button>
            </div>

            {/* Support Footer */}
            <div className="mt-auto pt-16 text-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-loose">
                Still having trouble? <br/>
                <button 
                  onClick={() => setSuccess(false)}
                  className="text-primary hover:underline font-black mt-1"
                >
                  CONTACT YOUR ADMINISTRATOR
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-top-6 duration-700">
            {/* Brand/Icon Section */}
            <div className="mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-primary/10 mb-8 border border-primary/20 shadow-2xl relative group">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="material-symbols-outlined text-primary text-4xl relative z-10">fingerprint</span>
              </div>
              <h1 className="text-white text-5xl font-display font-bold leading-tight tracking-tighter mb-4 uppercase italic">Reset Your Password</h1>
              <p className="text-slate-400 text-lg font-medium leading-relaxed tracking-tight">Enter your email address below, and we’ll send you a link to securely reset your password.</p>
            </div>

            {/* Recovery Form */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="rounded-2xl bg-red-500/10 p-4 text-2xs font-black uppercase tracking-spaced text-red-400 border border-red-500/20 flex items-center gap-2 animate-in shake duration-500">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className="text-slate-500 text-2xs font-black uppercase tracking-spread" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-500 group-focus-within:text-primary transition-colors text-xl">alternate_email</span>
                  </div>
                  <input 
                    className="block w-full pl-14 pr-4 py-5 bg-primary/5 border border-primary/10 rounded-[1.5rem] focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all outline-none text-white placeholder:text-slate-500 text-base font-medium" 
                    id="email" 
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. commander@rollcally.com" 
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-spread text-xs"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">verified_user</span>
                  </>
                )}
              </button>
            </form>

          </div>
        )}
      </main>
    </div>
  )
}
