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
      setError(signInError.message === 'Invalid login credentials' 
        ? 'Invalid email or password' 
        : signInError.message)
      return
    }

    navigate('/admin')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden">
      <div className="absolute top-0 -left-6 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob"></div>
      <div className="absolute bottom-0 -right-6 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob animation-delay-2000"></div>

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-slate hover:text-brand-primary transition-colors group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-brand-border group-hover:border-brand-primary/30 group-hover:bg-brand-primary/5 transition-all">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to Home
        </Link>

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-4 ring-white">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-text">
              Admin Portal
            </h1>
            <p className="mt-2 text-sm text-brand-slate font-medium">
              Manage your organization and track attendance.
            </p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-blue-100/50 bg-white/80 backdrop-blur-sm border-white/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {successMessage && (
              <div className="rounded-xl bg-green-50/80 backdrop-blur-sm p-4 text-sm text-green-700 border border-green-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 text-sm text-red-600 border border-red-100 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Link 
                    to="/admin/forgot-password" 
                    className="text-xs font-bold uppercase tracking-wider text-brand-primary hover:text-brand-primary/80"
                  >
                    Forgot password?
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

            <Button type="submit" size="lg" loading={loading} className="w-full mt-2 ring-offset-white">
              Sign in <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <div className="mt-2 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/admin/signup" className="font-bold text-brand-primary hover:text-brand-primary/80 underline-offset-4 hover:underline uppercase tracking-wider text-xs">
                Create a new organization
              </Link>
            </div>
          </form>
        </Card>

        <div className="mt-8 flex items-center justify-center">
          <Link to="/checkin" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
            Go to Check-in
          </Link>
        </div>
      </div>
    </div>
  )
}
