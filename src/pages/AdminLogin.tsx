import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { Users, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

export default function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const successMessage = (location.state as { message?: string })?.message

  // If already signed in as admin, go straight to dashboard
  useEffect(() => {
    const role = session?.user.user_metadata?.role
    const isAdmin = role === 'admin' || role === 'superadmin'
    
    if (session && isAdmin) {
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden font-inter">
      {/* Decorative background elements */}
      <div className="absolute top-0 -left-10 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-0 -right-10 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 animate-pulse delay-700"></div>

      <div className="relative w-full max-w-md">
        <header className="mb-12 flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-top-10 duration-1000">
          <div className="group relative">
            <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-20 transition-opacity duration-500"></div>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-1 ring-white/20">
              <Users className="h-10 w-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-brand-text italic">Admin Portal</h1>
            <p className="mt-2 text-sm text-brand-slate font-bold uppercase tracking-[0.2em] opacity-40">Rollcally Command Center</p>
          </div>
        </header>

        <Card className="p-10 border-brand-border/50 bg-white/80 backdrop-blur-xl shadow-2xl shadow-brand-primary/10 rounded-[3rem] animate-in fade-in zoom-in-95 duration-500 delay-300">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {successMessage && (
              <div className="rounded-2xl bg-green-50/80 backdrop-blur-sm p-4 text-xs font-bold uppercase tracking-wider text-green-700 border border-green-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-50 p-4 text-xs font-bold uppercase tracking-wider text-red-600 border border-red-100 animate-in shake duration-500">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <Input
                label="Administrator Email"
                type="email"
                placeholder="admin@rollcally.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-slate opacity-60">Password</label>
                  <Link 
                    to="/admin/forgot-password" 
                    className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:text-brand-primary/80 transition-colors"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" size="lg" loading={loading} className="w-full h-14 text-sm font-bold uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/20 mt-2">
              Sign in <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <div className="pt-8 mt-4 border-t border-brand-border text-center">
              <p className="text-xs text-brand-slate font-medium opacity-60">New organization?</p>
              <Link to="/admin/signup" className="mt-2 inline-block font-black text-xs uppercase tracking-[0.3em] text-brand-primary hover:underline underline-offset-8">
                Request Access
              </Link>
            </div>
          </form>
        </Card>

        <div className="mt-12 flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-brand-slate opacity-40">
          <Link to="/" className="hover:text-brand-primary transition-colors flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <Link to="/checkin" className="hover:text-brand-primary transition-colors underline underline-offset-4">
            Member Check-in
          </Link>
        </div>
      </div>
    </div>
  )
}
