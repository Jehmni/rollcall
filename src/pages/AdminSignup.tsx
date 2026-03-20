import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminSignup() {
  const navigate = useNavigate()
  const { session, isSuper, adminUnits, signUp, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If already signed in as admin, go straight to dashboard
  useEffect(() => {
    if (session && (isSuper || adminUnits.length > 0)) {
      navigate('/admin', { replace: true })
    }
  }, [session, isSuper, adminUnits, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { error: signUpError } = await signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          role: 'admin' // Default role for new signups
        },
        emailRedirectTo: `${window.location.origin}/admin`
      }
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    // Success! If email confirmation is disabled in Supabase, 
    // the user might be signed in automatically. 
    // We sign them out to ensure they go to the login flow as requested.
    await signOut()
    
    setLoading(false)
    navigate('/admin/login', { 
      state: { message: 'Account created successfully! Please sign in.' },
      replace: true 
    })
  }

  return (
    <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased selection:bg-primary/30">
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative background blurs */}
        <div className="absolute top-0 right-0 -z-10 opacity-20 pointer-events-none">
          <div className="w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full"></div>
        </div>
        <div className="absolute bottom-0 left-0 -z-10 opacity-10 pointer-events-none">
          <div className="w-[300px] h-[300px] bg-primary/30 blur-[100px] rounded-full"></div>
        </div>

        <div className="w-full max-w-md mx-auto relative z-10">
          <div className="text-center mb-10 animate-in fade-in slide-in-from-top-6 duration-700">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.25rem] bg-primary mb-6 shadow-[0_0_25px_rgba(82,71,230,0.4)] relative group overflow-hidden">
              <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              <span className="material-symbols-outlined text-white text-3xl">corporate_fare</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-3 uppercase italic">
              Create Your Account
            </h1>
            <p className="text-slate-400 text-sm px-4 leading-relaxed font-medium">
              Empower your team with better organization tools.
            </p>
          </div>

          <div className="bg-primary/5 rounded-[2.5rem] p-8 shadow-2xl border border-primary/10 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-500 delay-200">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-xl bg-red-500/10 p-4 text-xs font-black uppercase tracking-spaced text-red-400 border border-red-500/20 flex items-center gap-2 animate-in shake duration-500">
                  <span className="material-symbols-outlined text-base">warning</span>
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-2xs font-black text-slate-500 uppercase tracking-spaced ml-1" htmlFor="email">
                  Email Address
                </label>
                <input 
                  className="w-full px-5 py-5 rounded-[1.5rem] border border-primary/10 bg-primary/5 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all duration-200 outline-none text-base font-medium" 
                  id="email" 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com" 
                  required 
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-2xs font-black text-slate-500 uppercase tracking-spaced ml-1" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input 
                    className="w-full px-5 py-5 rounded-[1.5rem] border border-primary/10 bg-primary/5 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all duration-200 outline-none text-base font-medium pr-14" 
                    id="password" 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    required 
                    autoComplete="new-password"
                  />
                  <button 
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-2xs font-black text-slate-500 uppercase tracking-spaced ml-1" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <input 
                  className="w-full px-5 py-5 rounded-[1.5rem] border border-primary/10 bg-primary/5 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all duration-200 outline-none text-base font-medium" 
                  id="confirm-password" 
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                  autoComplete="new-password"
                />
              </div>

              <div className="pt-2">
                <button 
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-primary/40 transition-all active:scale-[0.98] uppercase tracking-spread text-xs disabled:opacity-50 disabled:cursor-not-allowed group" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Enlisting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>Get Started</span>
                      <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Already have an account? 
                <Link className="text-primary font-bold hover:text-primary transition-colors ml-1 uppercase tracking-wider underline underline-offset-4" to="/admin/login">
                  Log In
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-10 text-center px-8 animate-in fade-in duration-1000 delay-500">
            <p className="text-2xs uppercase tracking-spaced text-slate-500 font-bold leading-relaxed">
              By signing up, you agree to our <br/>
              <a className="underline hover:text-slate-300 transition-colors" href="#">Terms of Service</a> and <a className="underline hover:text-slate-300 transition-colors" href="#">Privacy Policy</a>
            </p>
          </div>
        </div>
        
        {/* Mobile-style home indicator decoration */}
        <div className="fixed bottom-2 w-32 h-1 bg-white/10 rounded-full left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  )
}
