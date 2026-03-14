import { useNavigate } from 'react-router-dom'
import { Users, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden font-inter">
      {/* Decorative background elements */}
      <div className="absolute top-0 -left-10 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
      <div className="absolute bottom-0 -right-10 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -z-10 animate-pulse delay-700"></div>

      <div className="w-full max-w-5xl text-center relative z-10 py-20">
        <header className="mb-20 flex flex-col items-center animate-in fade-in slide-in-from-top-10 duration-1000">
          <div className="group relative mb-8">
            <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-1 ring-white/20">
              <Users className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-brand-text sm:text-8xl italic">
            Rollcally
          </h1>
          <p className="mt-6 text-xl text-brand-slate max-w-xl mx-auto font-medium leading-relaxed opacity-70">
            Attendance tracking reimagined. <br className="hidden sm:block" />
            Clean, professional, and built for speed.
          </p>
        </header>

        <div className="grid gap-8 sm:grid-cols-2 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
          {/* Member Card */}
          <button
            onClick={() => navigate('/checkin')}
            className="group relative flex flex-col items-start p-12 text-left transition-all bg-white border border-brand-border/50 rounded-[3rem] shadow-sm hover:shadow-2xl hover:-translate-y-3 active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-brand-primary/5 blur-3xl group-hover:bg-brand-primary/10 transition-colors"></div>
            <div className="relative mb-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/5 text-brand-primary transition-all group-hover:bg-brand-primary group-hover:text-white group-hover:rotate-6">
              <Users className="h-8 w-8" />
            </div>
            <h2 className="text-4xl font-extrabold text-brand-text leading-tight">I'm Here</h2>
            <p className="mt-4 text-brand-slate text-lg leading-relaxed font-medium opacity-60">
              Joining a meeting? Tap here to record your attendance in seconds.
            </p>
            <div className="mt-12 flex items-center text-sm font-bold uppercase tracking-[0.2em] text-brand-primary">
              Check-in Now <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-3" />
            </div>
          </button>

          {/* Admin Card */}
          <button
            onClick={() => navigate('/admin')}
            className="group relative flex flex-col items-start p-12 text-left transition-all bg-white border border-brand-border/50 rounded-[3rem] shadow-sm hover:shadow-2xl hover:-translate-y-3 active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-brand-primary/5 blur-3xl group-hover:bg-brand-primary/10 transition-colors"></div>
            <div className="relative mb-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/5 text-brand-primary transition-all group-hover:bg-brand-primary group-hover:text-white group-hover:-rotate-6">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-4xl font-extrabold text-brand-text leading-tight">Admin Portal</h2>
            <p className="mt-4 text-brand-slate text-lg leading-relaxed font-medium opacity-60">
              Manage your units, members, and events with powerful analytics.
            </p>
            <div className="mt-12 flex items-center text-sm font-bold uppercase tracking-[0.2em] text-brand-primary">
              Control Center <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-3" />
            </div>
          </button>
        </div>

        <footer className="mt-32 flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-700">
          <div className="h-[1px] w-12 bg-brand-border"></div>
          <p className="text-sm text-brand-slate font-bold uppercase tracking-[0.3em] opacity-40">
            © {new Date().getFullYear()} Rollcally • Unified Attendance
          </p>
        </footer>
      </div>
    </div>
  )
}
