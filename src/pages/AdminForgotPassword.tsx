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
          <span className="text-sm font-bold uppercase tracking-wider">Portal Access</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(82,71,230,0.2)]">
            <span className="material-symbols-outlined text-primary text-xl">shield_person</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-12 pb-20 max-w-md mx-auto w-full relative z-10">
        {success ? (
          <div className="animate-in fade-in zoom-in-95 duration-700 h-full flex flex-col">
            <div className="mb-10 text-center sm:text-left">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-green-500/10 mb-8 border border-green-500/20 shadow-2xl relative group">
                <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full animate-pulse"></div>
                <span className="material-symbols-outlined text-green-500 text-4xl relative z-10">mark_email_read</span>
              </div>
              <h1 className="text-white text-5xl font-black leading-tight tracking-tighter mb-4 uppercase italic">Transmission Sent</h1>
              <p className="text-slate-400 text-lg font-medium leading-relaxed tracking-tight">
                Encrypted reset instructions have been dispatched to:
                <br/>
                <span className="text-primary font-black mt-2 block break-all">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => navigate('/admin/login')}
                className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 uppercase tracking-[0.3em] text-xs"
              >
                <span>Back to Login</span>
                <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">login</span>
              </button>
              <button 
                onClick={() => setSuccess(false)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-primary transition-colors"
              >
                Resend Directive
              </button>
            </div>

            <div className="mt-auto pt-16">
              <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl flex items-start gap-4 backdrop-blur-sm">
                <span className="material-symbols-outlined text-primary text-xl">verified</span>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-wider">
                  Check your spam folder if the transmission does not arrive within 300 seconds.
                </p>
              </div>
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
              <h1 className="text-white text-5xl font-black leading-tight tracking-tighter mb-4 uppercase italic">Reset Your Password</h1>
              <p className="text-slate-400 text-lg font-medium leading-relaxed tracking-tight">Enter your email address below, and we’ll send you a link to securely reset your password.</p>
            </div>

            {/* Recovery Form */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="rounded-2xl bg-red-500/10 p-4 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 border border-red-500/20 flex items-center gap-2 animate-in shake duration-500">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-500 group-focus-within:text-primary transition-colors text-xl">alternate_email</span>
                  </div>
                  <input 
                    className="block w-full pl-14 pr-4 py-5 bg-primary/5 border border-primary/10 rounded-[1.5rem] focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all outline-none text-white placeholder:text-slate-600 text-base font-medium" 
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
                className="w-full bg-primary hover:bg-primary/90 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.3em] text-xs"
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
