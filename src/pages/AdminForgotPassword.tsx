import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

export default function AdminForgotPassword() {
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-white px-4 py-12 overflow-hidden relative">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative w-full max-w-md">
        <button
          onClick={() => window.location.href = '/admin/login'}
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-blue-600 transition-colors group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/50 backdrop-blur-sm ring-1 ring-gray-200 group-hover:ring-blue-200 group-hover:bg-blue-50">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to Login
        </button>

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 shadow-xl shadow-blue-200 ring-4 ring-blue-50">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reset Password</h1>
            <p className="mt-2 text-gray-500 text-sm">Enter your email and we'll send you a reset link</p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-blue-100/50 bg-white/80 backdrop-blur-sm border-white/50">
          {success ? (
            <div className="flex flex-col items-center gap-6 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 border border-green-100">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Check your inbox</h2>
                <p className="text-sm text-gray-500 px-4">
                  If an account exists for <span className="font-semibold text-gray-900">{email}</span>, 
                  you will receive a password reset link shortly.
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3 w-full">
                <Button variant="secondary" onClick={() => setSuccess(false)}>
                  Try another email
                </Button>
                <Link to="/admin/login" className="flex items-center justify-center text-sm font-semibold text-blue-700 hover:text-blue-800">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 text-sm text-red-600 border border-red-100 animation-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}

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

              <Button type="submit" size="lg" loading={loading} className="w-full mt-2 ring-offset-white">
                Send reset link
              </Button>

              <Link 
                to="/admin/login" 
                className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
