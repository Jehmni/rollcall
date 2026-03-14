import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users } from 'lucide-react'
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
        setError('This email is not registered. Please contact your administrator.')
      } else {
        setError(error.message)
      }
      return
    }

    setStep('check_email')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden font-inter">
      {/* Decorative background elements */}
      <div className="absolute top-0 -left-10 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-0 -right-10 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 animate-pulse delay-700"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="mb-12 flex flex-col items-center gap-7 text-center animate-in fade-in slide-in-from-top-10 duration-1000">
          <div className="group relative">
            <div className="absolute inset-0 bg-brand-primary blur-3xl opacity-20 transition-opacity duration-500"></div>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-1 ring-white/20">
              <Users className="h-12 w-12 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-brand-text italic">Rollcally</h1>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.4em] text-brand-slate opacity-40">Smart Entry Protocol</p>
          </div>
        </div>

        <Card className="p-10 border-brand-border/50 bg-white shadow-2xl shadow-brand-primary/10 rounded-[2.5rem] animate-in fade-in zoom-in-95 duration-500 delay-300">
          {step === 'enter_email' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-brand-text uppercase tracking-tighter italic">Authorize Entry</h2>
                <p className="mt-3 text-brand-slate font-medium opacity-60 leading-relaxed text-sm">
                   Enter your registered credentials to establish a secure session link.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  error={error ?? undefined}
                  required
                  autoComplete="email"
                  autoFocus
                />
                <Button type="submit" size="lg" loading={loading} className="w-full h-14 text-sm font-bold uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/20">
                  Send Link
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 shadow-inner">
                <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-brand-text uppercase tracking-tighter italic">Signal Sent</h2>
              <p className="mt-4 text-brand-slate font-medium opacity-60 leading-relaxed text-sm max-w-[200px] mx-auto">
                A secure transmission has been sent to <span className="font-bold text-brand-text uppercase">{email}</span>.
              </p>
              
              <div className="mt-10 pt-10 border-t border-brand-border w-full">
                <button
                  onClick={() => { setStep('enter_email'); setError(null) }}
                  className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Support Link */}
        <p className="mt-12 text-center text-xs text-brand-slate font-medium opacity-40">
          Not receiving the link? <a href="#" className="underline">Contact Organization Admin</a>
        </p>
      </div>
    </div>
  )
}
