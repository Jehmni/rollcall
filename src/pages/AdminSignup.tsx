import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function AdminSignup() {
  const navigate = useNavigate()
  const { session, isSuper, adminUnits, signUp, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-primary/[0.05] via-transparent to-transparent"></div>
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-primary/5 blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-primary/5 blur-[100px] -z-10 animate-pulse animation-delay-2000"></div>

      <div className="relative w-full max-w-lg">
        <Link
          to="/admin/login"
          className="absolute -top-16 left-0 inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 hover:opacity-100 hover:text-brand-primary transition-all group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-brand-border/50 group-hover:scale-110 group-hover:rotate-12 transition-all shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </div>
          Return to Portal
        </Link>

        <div className="mb-12 flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-[12px] ring-white relative group">
            <div className="absolute inset-0 rounded-[2.5rem] bg-white transition-all group-hover:scale-110 group-hover:rotate-6 -z-10 opacity-0 group-hover:opacity-10"></div>
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter italic text-brand-text mb-2">
              JOIN THE CADRE
            </h1>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
              Administer your organization with precision
            </p>
          </div>
        </div>

        <div className="rounded-[3rem] bg-white p-12 shadow-2xl shadow-brand-primary/10 border border-brand-border/50 animate-in zoom-in-95 duration-700">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {error && (
              <div className="rounded-2xl bg-red-50 p-5 text-[11px] font-bold text-red-600 border border-red-100 flex items-center gap-3 animate-in shake duration-500">
                <div className="h-2 w-2 rounded-full bg-red-500 shadow-sm animate-pulse"></div>
                {error}
              </div>
            )}

            <div className="space-y-6">
              <Input
                label="Enter your email"
                type="email"
                placeholder="commander@organization.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-16 rounded-2xl border-brand-border/50 focus:ring-brand-primary/20 bg-brand-secondary/30"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-16 rounded-2xl border-brand-border/50 focus:ring-brand-primary/20 bg-brand-secondary/30"
                />

                <Input
                  label="Verify password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-16 rounded-2xl border-brand-border/50 focus:ring-brand-primary/20 bg-brand-secondary/30"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              loading={loading} 
              className="w-full h-16 rounded-[1.5rem] bg-brand-primary hover:bg-brand-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-brand-primary/30 transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative"
            >
              <span className="relative z-10">Enlist Now</span>
              <div className="absolute top-0 left-0 w-full h-full bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </Button>

            <div className="pt-4 text-center border-t border-brand-border/30">
              <p className="text-[10px] font-bold text-brand-slate opacity-40 uppercase tracking-widest leading-loose">
                Already Have an Account? <br/>
                <Link to="/admin/login" className="text-brand-primary hover:text-brand-primary/80 transition-colors font-black ml-1">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>

        <p className="mt-12 text-center text-[10px] font-bold text-brand-slate opacity-20 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
          Standard operational protocols apply. By enlisting, you authorize full system integration.
        </p>
      </div>
    </div>
  )
}
