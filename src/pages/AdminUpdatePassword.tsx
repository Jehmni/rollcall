import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, CheckCircle2, ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

export default function AdminUpdatePassword() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // If already signed in as admin AND NOT on a recovery flow, 
  // we could redirect. But on a recovery flow, session might exist temporarily.
  // Actually, Supabase sets the session via the recovery link.
  // So we only redirect if the password update is already done.
  
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
    const { error: updateError } = await updatePassword({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      navigate('/admin/login')
    }, 3000)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-white px-4 py-12 overflow-hidden relative">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 shadow-xl shadow-blue-200 ring-4 ring-blue-50">
            <Save className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Set New Password</h1>
            <p className="mt-2 text-gray-500 text-sm">Please enter your new secure password below</p>
          </div>
        </div>

        <Card className="shadow-2xl shadow-blue-100/50 bg-white/80 backdrop-blur-sm border-white/50">
          {success ? (
            <div className="flex flex-col items-center gap-6 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 border border-green-100">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Password Updated!</h2>
                <p className="text-sm text-gray-500 px-4">
                  Your password has been changed successfully. 
                  Redirecting you to login in a few seconds...
                </p>
              </div>
              <Button onClick={() => navigate('/admin/login')} className="mt-4 ring-offset-white">
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && (
                <div className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 text-sm text-red-600 border border-red-100">
                  {error}
                </div>
              )}

              <div className="rounded-xl bg-blue-50/50 p-3 flex gap-3 text-xs text-blue-700 border border-blue-100/50">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <p>Make sure your password is unique and at least 6 characters long.</p>
              </div>

              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                autoFocus
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />

              <Button type="submit" size="lg" loading={loading} className="w-full mt-2 ring-offset-white">
                Update Password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
