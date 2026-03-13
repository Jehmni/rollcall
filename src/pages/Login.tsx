import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Music } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'

type Step = 'enter_email' | 'check_email'

export default function Login() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<Step>('enter_email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const redirectPath = searchParams.get('redirect') ?? '/checkin'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const redirectUrl = `${window.location.origin}${decodeURIComponent(redirectPath)}`

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false, // Only allow pre-registered choristers
      },
    })

    setLoading(false)

    if (error) {
      if (error.message.toLowerCase().includes('not found') || error.status === 422) {
        setError('This email is not registered. Please contact your choir leader.')
      } else {
        setError(error.message)
      }
      return
    }

    setStep('check_email')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 shadow-lg">
            <Music className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Rollcally</h1>
            <p className="text-sm text-gray-500">Attendance made simple</p>
          </div>
        </div>

        <Card>
          {step === 'enter_email' ? (
            <>
              <h2 className="mb-1 text-lg font-semibold text-gray-900">Sign in</h2>
              <p className="mb-5 text-sm text-gray-500">
                Enter your registered email to receive a sign-in link.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  error={error ?? undefined}
                  required
                  autoComplete="email"
                  autoFocus
                />
                <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
                  Send magic link
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
                <p className="mt-1 text-sm text-gray-500">
                  We sent a sign-in link to <span className="font-medium text-gray-700">{email}</span>.
                  Tap the link to sign in.
                </p>
              </div>
              <button
                onClick={() => { setStep('enter_email'); setError(null) }}
                className="text-sm text-blue-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
