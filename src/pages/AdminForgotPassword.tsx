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
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden">
      <div className="absolute top-0 -left-6 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob"></div>
      <div className="absolute bottom-0 -right-6 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob animation-delay-2000"></div>

      <div className="relative w-full max-w-md">
        <Link
          to="/admin/login"
          className="absolute -top-12 left-0 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-slate hover:text-brand-primary transition-colors group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-brand-border group-hover:border-brand-primary/30 group-hover:bg-brand-primary/5">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Back to Login
        </Link>

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-4 ring-white">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-text">
              Forgot Password
            </h1>
            <p className="mt-2 text-sm text-brand-slate font-medium">
              Enter your email to receive a password reset link.
            </p>
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
              <Link to="/admin/login" className="flex items-center justify-center text-sm font-bold uppercase tracking-wider text-brand-primary hover:text-brand-primary/80">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
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
