import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-dark px-4 relative overflow-hidden font-display">
      {/* Decorative glow orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" aria-hidden="true"></div>
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/8 rounded-full blur-[100px] -z-10 pointer-events-none" aria-hidden="true"></div>

      <div className="relative w-full max-w-lg">
        <button
          onClick={() => navigate('/admin/login')}
          className="absolute -top-16 left-0 inline-flex items-center gap-3 text-2xs font-black uppercase tracking-spread text-slate-500 hover:text-primary-light transition-all group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-low border border-white/5 group-hover:scale-110 transition-all">
            <span className="material-symbols-outlined text-xl" aria-hidden="true">arrow_back</span>
          </div>
          Portal Access
        </button>

        <div className="mb-16 flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/70 shadow-[0_0_60px_rgba(82,71,230,0.4)] ring-1 ring-white/10 relative group">
            <span className="material-symbols-outlined text-primary-light text-5xl" aria-hidden="true">key</span>
          </div>
          <div>
            <h1 className="text-5xl font-display font-black tracking-tighter text-white">
              UPDATE SECURITY
            </h1>
            <p className="mt-2 text-2xs font-black uppercase tracking-spread text-primary/60">
              Credentials modification protocol
            </p>
          </div>
        </div>

        <div className="rounded-[2.5rem] bg-surface-low p-12 shadow-[0_20px_40px_rgba(7,13,31,0.4)] animate-in zoom-in-95 duration-700">
          {success ? (
            <div className="flex flex-col items-center gap-8 py-4 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary/10 border border-primary/20 shadow-[0_0_40px_rgba(82,71,230,0.2)]">
                <span className="material-symbols-outlined text-primary-light text-5xl" aria-hidden="true">check_circle</span>
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tighter">Security Updated</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-spaced leading-loose px-4">
                  New credentials have been successfully authorized. <br/>
                  <span className="text-primary-light font-black">Redirecting to headquarters...</span>
                </p>
              </div>
              <Button
                onClick={() => navigate('/admin/login')}
                className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-spaced text-xs shadow-2xl shadow-primary/30 transition-all active:scale-95"
              >
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              {error && (
                <div className="rounded-2xl bg-red-500/10 p-5 text-xs font-bold text-red-400 border border-red-500/20 flex items-center gap-3 animate-in shake duration-500">
                  <span className="material-symbols-outlined text-base flex-shrink-0" aria-hidden="true">warning</span>
                  {error}
                </div>
              )}

              <div className="rounded-2xl bg-primary/5 p-5 flex gap-4 text-2xs font-bold text-primary-light border border-primary/10 leading-relaxed uppercase tracking-widest">
                <span className="material-symbols-outlined text-xl flex-shrink-0" aria-hidden="true">shield_lock</span>
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
                />

                <Input
                  label="Verify Security String"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-spaced text-xs shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative"
              >
                <span className="relative z-10">Finalize Update</span>
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" aria-hidden="true"></div>
              </Button>
            </form>
          )}
        </div>

        <p className="mt-12 text-center text-2xs font-bold text-slate-600 uppercase tracking-spaced max-w-xs mx-auto leading-relaxed">
          Standard operational protocols apply. Security modifications are tracked and archived.
        </p>
      </div>
    </div>
  )
}
