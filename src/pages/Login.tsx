import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-dark px-4 relative overflow-hidden font-sans">
      {/* Decorative glow orbs */}
      <div className="absolute top-0 -left-10 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" aria-hidden="true"></div>
      <div className="absolute bottom-0 -right-10 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" aria-hidden="true"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="mb-16 flex flex-col items-center gap-7 text-center animate-in fade-in slide-in-from-top-10 duration-1000">
          <div className="group relative">
            <div className="absolute inset-0 bg-primary blur-3xl opacity-20 transition-opacity duration-500" aria-hidden="true"></div>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_60px_rgba(82,71,230,0.4)] ring-1 ring-white/10">
              <span className="material-symbols-outlined text-primary-light text-5xl" aria-hidden="true">groups</span>
            </div>
          </div>
          <div>
            <h1 className="text-5xl font-display font-black tracking-tighter text-white">Rollcally</h1>
            <p className="mt-2 text-2xs font-black uppercase tracking-super text-primary/60">Smart Entry Protocol</p>
          </div>
        </div>

        {/* Card */}
        <div className="p-10 bg-surface-low rounded-[2.5rem] shadow-[0_20px_40px_rgba(7,13,31,0.4)] animate-in fade-in zoom-in-95 duration-500 delay-300">
          {step === 'enter_email' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-10">
                <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Authorize Entry</h2>
                <p className="mt-3 text-slate-400 font-medium leading-relaxed text-sm">
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
                <Button type="submit" size="lg" loading={loading} className="w-full h-14 text-sm font-bold uppercase tracking-spaced shadow-lg shadow-primary/20">
                  Send Link
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-primary/10 border border-primary/20 shadow-[0_0_30px_rgba(82,71,230,0.2)]">
                <span className="material-symbols-outlined text-primary-light text-4xl" aria-hidden="true">mark_email_read</span>
              </div>
              <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Signal Sent</h2>
              <p className="mt-4 text-slate-400 font-medium leading-relaxed text-sm max-w-[200px] mx-auto">
                A secure transmission has been sent to <span className="font-bold text-white uppercase">{email}</span>.
              </p>

              <div className="mt-10 pt-10 w-full">
                <button
                  onClick={() => { setStep('enter_email'); setError(null) }}
                  className="text-xs font-black uppercase tracking-spread text-primary-light hover:text-white transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Support Link */}
        <p className="mt-12 text-center text-xs text-slate-500 font-medium">
          Not receiving the link? <a href="#" className="text-primary-light hover:text-white transition-colors">Contact Organization Admin</a>
        </p>
      </div>
    </div>
  )
}
