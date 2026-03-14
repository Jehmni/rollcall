import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, CheckCircle2, ShieldAlert, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-primary/[0.05] via-transparent to-transparent"></div>
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-primary/5 blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-primary/5 blur-[100px] -z-10 animate-pulse animation-delay-2000"></div>

      <div className="relative w-full max-w-lg">
        <button
          onClick={() => navigate('/admin/login')}
          className="absolute -top-16 left-0 inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 hover:opacity-100 hover:text-brand-primary transition-all group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-brand-border/50 group-hover:scale-110 group-hover:rotate-12 transition-all shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </div>
          Portal Access
        </button>

        <div className="mb-12 flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-[12px] ring-white relative group">
            <div className="absolute inset-0 rounded-[2.5rem] bg-white transition-all group-hover:scale-110 group-hover:rotate-6 -z-10 opacity-0 group-hover:opacity-10"></div>
            <KeyRound className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter italic text-brand-text mb-2">
              UPDATE SECURITY
            </h1>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
              Credentials modification protocol
            </p>
          </div>
        </div>

        <div className="rounded-[3rem] bg-white p-12 shadow-2xl shadow-brand-primary/10 border border-brand-border/50 animate-in zoom-in-95 duration-700">
          {success ? (
            <div className="flex flex-col items-center gap-8 py-4 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-50 text-green-600 border border-green-100 ring-[12px] ring-green-50/50">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Security Updated</h2>
                <p className="text-[11px] font-bold text-brand-slate opacity-40 uppercase tracking-[0.2em] leading-loose px-4">
                  New credentials have been successfully authorized. <br/>
                  <span className="text-brand-primary font-black">Redirecting to headquarters...</span>
                </p>
              </div>
              <Button 
                onClick={() => navigate('/admin/login')} 
                className="w-full h-16 rounded-[1.5rem] bg-brand-primary hover:bg-brand-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-brand-primary/30 transition-all active:scale-95"
              >
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              {error && (
                <div className="rounded-2xl bg-red-50 p-5 text-[11px] font-bold text-red-600 border border-red-100 flex items-center gap-3 animate-in shake duration-500">
                  <div className="h-2 w-2 rounded-full bg-red-500 shadow-sm animate-pulse"></div>
                  {error}
                </div>
              )}

              <div className="rounded-2xl bg-brand-primary/5 p-5 flex gap-4 text-[10px] font-bold text-brand-primary border border-brand-primary/10 leading-relaxed uppercase tracking-widest">
                <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                <p>Authorized access requires a unique security string of at least 6 characters.</p>
              </div>

              <div className="space-y-6">
                <Input
                  label="New Security String"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  autoFocus
                  className="h-16 rounded-2xl border-brand-border/50 focus:ring-brand-primary/20 bg-brand-secondary/30"
                />

                <Input
                  label="Verify Security String"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-16 rounded-2xl border-brand-border/50 focus:ring-brand-primary/20 bg-brand-secondary/30"
                />
              </div>

              <Button 
                type="submit" 
                loading={loading} 
                className="w-full h-16 rounded-[1.5rem] bg-brand-primary hover:bg-brand-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-brand-primary/30 transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative"
              >
                <span className="relative z-10">Finalize Update</span>
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </Button>
            </form>
          )}
        </div>

        <p className="mt-12 text-center text-[10px] font-bold text-brand-slate opacity-20 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
          Standard operational protocols apply. Security modifications are tracked and archived.
        </p>
      </div>
    </div>
  )
}
