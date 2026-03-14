import { useNavigate } from 'react-router-dom'
import { Users, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-secondary px-4 relative overflow-hidden">
      <div className="w-full max-w-4xl text-center relative z-10">
        <div className="absolute top-0 -left-10 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob"></div>
        <div className="absolute bottom-0 -right-10 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-blob animation-delay-2000"></div>

        <header className="relative mb-16 flex flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-primary shadow-2xl shadow-brand-primary/40 ring-8 ring-white">
            <Users className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight text-brand-text sm:text-7xl">
              Rollcally
            </h1>
            <p className="mt-4 text-xl text-brand-slate max-w-lg mx-auto font-medium opacity-80">
              Simple, secure, and smart attendance tracking for the modern organization.
            </p>
          </div>
        </header>

        <div className="relative grid gap-6 sm:grid-cols-2">
          {/* Member Card */}
           <button
            onClick={() => navigate('/checkin')}
            className="group relative flex flex-col items-start p-10 text-left transition-all bg-white border border-brand-border rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/5 text-primary transition-all group-hover:bg-brand-primary group-hover:text-white group-hover:rotate-3">
              <Users className="h-7 w-7 text-brand-primary group-hover:text-white" />
            </div>
             <h2 className="text-3xl font-bold text-brand-text">Member Check-in</h2>
            <p className="mt-4 text-brand-slate leading-relaxed font-medium">
              Scan a QR code or find your name to record your attendance for the active event.
            </p>
            <div className="mt-10 flex items-center text-sm font-bold uppercase tracking-wider text-brand-primary">
              Start Check-in <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" />
            </div>
          </button>

          {/* Admin Card */}
           <button
            onClick={() => navigate('/admin')}
            className="group relative flex flex-col items-start p-10 text-left transition-all bg-white border border-brand-border rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]"
          >
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/5 text-primary transition-all group-hover:bg-brand-primary group-hover:text-white group-hover:-rotate-3">
              <ShieldCheck className="h-7 w-7 text-brand-primary group-hover:text-white" />
            </div>
             <h2 className="text-3xl font-bold text-brand-text">Admin Portal</h2>
            <p className="mt-4 text-brand-slate leading-relaxed font-medium">
              Manage members, create new events, view reports, and generate QR codes for check-in.
            </p>
            <div className="mt-10 flex items-center text-sm font-bold uppercase tracking-wider text-brand-primary">
              Log in to Dashboard <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" />
            </div>
          </button>
        </div>

         <footer className="relative mt-24 text-sm text-brand-slate font-medium opacity-60">
          <p>© {new Date().getFullYear()} Rollcally • High Performance Attendance</p>
        </footer>
      </div>
    </div>
  )
}
