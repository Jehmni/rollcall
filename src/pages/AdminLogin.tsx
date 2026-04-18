import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const successMessage = (location.state as { message?: string })?.message

  // If already signed in, go straight to dashboard
  useEffect(() => {
    if (session) {
      navigate('/admin', { replace: true })
    }
  }, [session, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: signInError } = await signIn({
      email: email.trim().toLowerCase(),
      password,
    })

    setLoading(false)

    if (signInError) {
      console.error('Login error:', signInError)
      if (signInError.message === 'Invalid login credentials') {
        setError('Invalid email or password')
      } else if (signInError.message.includes('Email not confirmed')) {
        setError('Please confirm your email address before signing in.')
      } else {
        setError(signInError.message)
      }
      return
    }

    navigate('/admin')
  }

  return (
    <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased">
      <div className="relative flex min-h-screen w-full flex-col bg-background-dark overflow-x-hidden">
        {/* Header */}
        <header className="flex items-center bg-background-dark p-4 justify-between sticky top-0 z-50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="text-primary flex size-10 shrink-0 items-center justify-center rounded-none bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="text-white text-lg font-bold leading-tight tracking-tight">Admin Portal</h2>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => navigate('/help')}
              className="size-10 rounded-none bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(82,71,230,0.2)] hover:bg-primary/20 transition-colors"
              title="User Guide"
            >
              <span className="material-symbols-outlined text-primary text-xl">help</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
          <div className="text-center mb-10 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="mb-6 inline-flex p-4 rounded-none bg-primaryr from-primary/20 to-primary/5 border border-primary/20 shadow-2xl relative group">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-none opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="material-symbols-outlined text-primary text-5xl relative z-10">shield_person</span>
            </div>
            <h3 className="text-white tracking-tight text-2xl font-display font-bold leading-tight flex items-center justify-center gap-3">
              <img src="/logo.png" alt="Rollcally" className="h-8 w-8 object-contain" />
              <span>Admin Portal</span>
            </h3>
            <p className="text-slate-400 mt-3 text-sm font-medium tracking-tight">Secure access for organization managers</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in zoom-in-95 duration-500 delay-200">
            {successMessage && (
              <div className="rounded-none bg-teal/10 p-4 text-2xs font-black uppercase tracking-spaced text-teal border border-teal/20 flex items-center gap-2 animate-in slide-in-from-top-4">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {successMessage}
              </div>
            )}

            {error && (
              <div className="rounded-none bg-red-500/10 p-4 text-2xs font-black uppercase tracking-spaced text-red-400 border border-red-500/20 flex items-center gap-2 animate-in shake duration-500">
                <span className="material-symbols-outlined text-base">warning</span>
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-slate-400 text-2xs font-black uppercase tracking-spread">Email</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full rounded-none text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-primary/20 bg-primary/5 h-16 pl-14 placeholder:text-slate-500 text-base font-medium transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-slate-400 text-2xs font-black uppercase tracking-spread">PASSWORD</label>
                <button 
                  type="button"
                  onClick={() => navigate('/admin/forgot-password')}
                  className="text-primary text-2xs font-black tracking-spaced uppercase hover:underline"
                >
                  FORGOT?
                </button>
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-none text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-primary/20 bg-primary/5 h-16 pl-14 pr-14 placeholder:text-slate-500 text-base font-medium transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-primary/40 transition-all active:scale-[0.98] uppercase tracking-spread text-xs mt-4 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-none border-2 border-white border-t-transparent"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Sign In</span>
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              )}
            </button>
          </form>

          {/* Secondary Actions */}
          <div className="mt-auto pt-16 animate-in fade-in duration-1000 delay-500">
            <div className="bg-primary/5 rounded-[2.5rem] p-8 border border-primary/10 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 size-32 bg-primary/10 rounded-none blur-3xl"></div>
              <p className="text-slate-400 text-center text-xs font-bold uppercase tracking-widest mb-6">New organization?</p>
              <button 
                onClick={() => navigate('/admin/signup')}
                className="w-full bg-background-dark text-white border border-primary/30 font-black py-4 rounded-none hover:bg-primary/10 transition-colors uppercase tracking-spread text-2xs"
              >
                REGISTER
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 pb-10">
              <button 
                onClick={() => navigate('/')}
                className="flex items-center justify-center gap-3 text-slate-500 hover:text-primary py-3 transition-all group"
              >
                <div className="bg-slate-500/10 p-2 rounded-none group-hover:bg-primary/10 group-hover:text-primary">
                  <span className="material-symbols-outlined text-xl">home</span>
                </div>
                <span className="text-2xs uppercase tracking-spaced font-black">HOME</span>
              </button>
              <button 
                onClick={() => navigate('/checkin')}
                className="flex items-center justify-center gap-3 text-slate-500 hover:text-primary py-3 transition-all group"
              >
                <div className="bg-slate-500/10 p-2 rounded-none group-hover:bg-primary/10 group-hover:text-primary">
                  <span className="material-symbols-outlined text-xl">how_to_reg</span>
                </div>
                <span className="text-2xs uppercase tracking-spaced font-black text-center">CHECK-IN</span>
              </button>
            </div>
          </div>
        </main>

        {/* Subtle Gradient Decor */}
        <div className="fixed bottom-0 left-0 w-full h-1 bg-transparent from-transparent via-primary to-transparent opacity-20"></div>
      </div>
    </div>
  )
}


