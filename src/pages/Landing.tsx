import { useNavigate } from 'react-router-dom'
import { Users, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-white px-4">
      <div className="w-full max-w-4xl text-center">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

        <header className="relative mb-12 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 shadow-xl shadow-blue-200 ring-4 ring-blue-50">
            <Users className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
              Rollcall
            </h1>
            <p className="mt-4 text-lg text-gray-500 max-w-lg mx-auto">
              Simple, secure, and smart attendance tracking for your organization.
            </p>
          </div>
        </header>

        <div className="relative grid gap-6 sm:grid-cols-2">
          {/* Member Card */}
          <button
            onClick={() => navigate('/checkin')}
            className="group relative flex flex-col items-start p-8 text-left transition-all bg-white/70 backdrop-blur-md border border-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-700 group-hover:text-white">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Member Check-in</h2>
            <p className="mt-2 text-gray-500 leading-relaxed">
              Scan a QR code or find your name to record your attendance for the active service.
            </p>
            <div className="mt-8 flex items-center text-sm font-semibold text-blue-700">
              Start Check-in <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Admin Card */}
          <button
            onClick={() => navigate('/admin')}
            className="group relative flex flex-col items-start p-8 text-left transition-all bg-white/70 backdrop-blur-md border border-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-700 group-hover:text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Portal</h2>
            <p className="mt-2 text-gray-500 leading-relaxed">
              Manage members, create new services, view reports, and generate QR codes for check-in.
            </p>
            <div className="mt-8 flex items-center text-sm font-semibold text-blue-700">
              Log in to Dashboard <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        <footer className="relative mt-16 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Rollcally Attendance System</p>
        </footer>
      </div>
    </div>
  )
}
