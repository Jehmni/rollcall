import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

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
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-primary/[0.05] via-transparent to-transparent"></div>
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-primary/5 blur-[100px] -z-10 animate-pulse"></div>
      <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-primary/5 blur-[100px] -z-10 animate-pulse animation-delay-2000"></div>

      <div className="relative w-full max-w-lg">
        <Link
          to="/admin/login"
          className="absolute -top-16 left-0 inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 hover:opacity-100 hover:text-brand-primary transition-all group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-brand-border/50 group-hover:scale-110 group-hover:rotate-12 transition-all shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </div>
          Portal Access
        </Link>

        <div className="mb-12 flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-[12px] ring-white relative group">
            <div className="absolute inset-0 rounded-[2.5rem] bg-white transition-all group-hover:scale-110 group-hover:rotate-6 -z-10 opacity-0 group-hover:opacity-10"></div>
            <KeyRound className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tighter italic text-brand-text mb-2">
              RECOVER ACCESS
            </h1>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
              Credentials re-authorization protocol
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
                <h2 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Transmission Sent</h2>
                <p className="text-[11px] font-bold text-brand-slate opacity-40 uppercase tracking-[0.2em] leading-loose px-4">
                  Encrypted instructions dispatched to <br/>
                  <span className="text-brand-primary font-black">{email}</span>
                </p>
              </div>
              <div className="mt-8 flex flex-col gap-4 w-full">
                <Button variant="secondary" onClick={() => setSuccess(false)} className="h-14 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                  Request Alternate Link
                </Button>
                <Link 
                  to="/admin/login" 
                  className="flex h-14 items-center justify-center rounded-2xl bg-brand-primary text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <ArrowLeft className="h-4 w-4 mr-3" />
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              {error && (
                <div className="rounded-2xl bg-red-50 p-5 text-[11px] font-bold text-red-600 border border-red-100 flex items-center gap-3 animate-in shake duration-500">
                  <div className="h-2 w-2 rounded-full bg-red-500 shadow-sm animate-pulse"></div>
                  {error}
                </div>
              )}

              <Input
                label="Registered Directive"
                type="email"
                placeholder="commander@organization.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="h-16 rounded-2xl border-brand-border/50 focus:ring-brand-primary/20 bg-brand-secondary/30"
              />

              <Button 
                type="submit" 
                loading={loading} 
                className="w-full h-16 rounded-[1.5rem] bg-brand-primary hover:bg-brand-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-brand-primary/30 transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative"
              >
                <span className="relative z-10">Authorize Recovery</span>
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </Button>

              <div className="pt-4 text-center border-t border-brand-border/30">
                <Link 
                  to="/admin/login" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 hover:opacity-100 hover:text-brand-primary transition-all flex items-center justify-center gap-3"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Abort Operation
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-12 text-center text-[10px] font-bold text-brand-slate opacity-20 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
          Standard operational protocols apply. Unauthorized access attempts are logged and scrutinized.
        </p>
      </div>
    </div>
  )
}
