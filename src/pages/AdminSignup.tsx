import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

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
      <div className="absolute top-0 -left-6 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob"></div>
      <div className="absolute bottom-0 -right-6 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob animation-delay-2000"></div>

      <div className="relative w-full max-w-md">
        <Link
          to="/admin/login"
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-slate hover:text-brand-primary transition-colors group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-brand-border group-hover:border-brand-primary/30 group-hover:bg-brand-primary/5 transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to Login
        </Link>

        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-4 ring-white">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-text">
              Get Started
            </h1>
            <p className="mt-2 text-sm text-brand-slate font-medium">
              Create an organization to start tracking attendance.
            </p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-brand-primary/10 bg-white/80 backdrop-blur-sm border-brand-border">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <Button type="submit" size="lg" loading={loading} className="w-full mt-2 ring-offset-white">
              Sign up
            </Button>

            <div className="mt-2 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/admin/login" className="font-bold text-brand-primary hover:text-brand-primary/80 underline-offset-4 hover:underline uppercase tracking-wider text-xs">
                Log in instead
              </Link>
            </div>
          </form>
        </Card>

        <p className="mt-8 text-center text-xs text-gray-400">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
