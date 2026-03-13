import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldPlus } from 'lucide-react'
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-white px-4 py-12 overflow-hidden relative">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 shadow-xl shadow-blue-200 ring-4 ring-blue-50">
            <ShieldPlus className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Admin Account</h1>
            <p className="mt-2 text-gray-500 text-sm">Join Rollcally to manage your organization's attendance</p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-blue-100/50 bg-white/80 backdrop-blur-sm border-white/50">
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
              <Link to="/admin/login" className="font-semibold text-blue-700 hover:text-blue-800 underline-offset-4 hover:underline">
                Sign in
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
