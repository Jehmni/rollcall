import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LiveCounterRing from '../components/LiveCounterRing'

// Defined as a string literal so Tailwind's JIT scanner picks it up at this line
const HERO_BG_CLASS = "bg-[url('/images/hero_bg.jpg')]"

function handleCardKey(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
}

export default function Landing() {
  const navigate = useNavigate()

  // Live Insights Animation State — static seed, fluctuates via interval
  const [chartBars, setChartBars] = useState([42, 65, 58, 85, 74, 94, 48])
  const [activeIndex, setActiveIndex] = useState(0)

  const presenceRate = chartBars[activeIndex]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % 7)
      setChartBars(current => {
        const next = [...current]
        if (Math.random() > 0.5) {
          const i = Math.floor(Math.random() * 7)
          next[i] = Math.max(40, Math.min(94, next[i] + (Math.floor(Math.random() * 14) - 7)))
        }
        return next
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-transparent font-sans text-slate-100 antialiased min-h-screen selection:bg-primary/30 selection:text-white overflow-hidden relative">

      {/* Decorative glow orbs — absolute so they don't repaint on scroll */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none z-0" aria-hidden="true"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none z-0" aria-hidden="true"></div>

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 flex items-center bg-[#020617]/50 backdrop-blur-xl px-6 py-4 justify-between transition-all duration-300" aria-label="Main navigation">
        <button
          className="flex items-center gap-3 group cursor-pointer bg-transparent border-0 p-0"
          onClick={() => navigate('/')}
          aria-label="Rollcally — go to homepage"
        >
          <img src="/logo.png" alt="" className="h-10 w-10 object-contain z-10 transition-transform group-hover:scale-110 drop-shadow-lg" aria-hidden="true" />
          <span className="text-white text-2xl font-display font-black italic tracking-tight">Rollcally</span>
        </button>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/help')} className="hidden sm:block text-slate-400 hover:text-white transition-colors font-medium text-sm">User Guide</button>
          <button onClick={() => navigate('/admin/login')} className="text-slate-300 hover:text-white font-semibold text-sm transition-colors">Sign In</button>
          <button onClick={() => navigate('/admin/signup')} className="relative overflow-hidden group bg-white text-slate-950 px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            <span className="relative z-10">Get Started</span>
            <div className="absolute inset-0 h-full w-full scale-0 rounded-full transition-all duration-300 group-hover:scale-100 group-hover:bg-primary/10" aria-hidden="true"></div>
          </button>
        </div>
      </nav>

      <main className="flex flex-col min-h-screen pt-24 pb-24 sm:pb-0 relative z-10 w-full">
        {/* Full-page background image — loaded once, reused via HERO_BG_CLASS */}
        <div className="fixed inset-0 w-full h-full z-0 pointer-events-none select-none" aria-hidden="true">
          <div className={`absolute inset-0 ${HERO_BG_CLASS} bg-cover bg-center opacity-[0.25] mix-blend-screen`}></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/40 via-[#020617]/70 to-[#020617]/95"></div>
        </div>

        {/* Hero Section */}
        <section className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-16 pb-20 max-w-5xl mx-auto w-full">
          <h1 className="font-display italic text-5xl sm:text-7xl font-black leading-[1.1] tracking-[0.02em] mb-8 drop-shadow-sm">
            Attendance{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 drop-shadow-md">Reimagined</span>
            <br />
            for Elite Organizations
          </h1>
          <p className="text-slate-300 text-lg sm:text-xl font-medium leading-relaxed max-w-2xl mb-10">
            Experience the pinnacle of smart check-ins, biometrics, and real-time geofencing. Built for the modern enterprise that demands absolute precision.
          </p>
          <div className="mt-12 w-full relative z-20 mb-16">
            <LiveCounterRing />
          </div>

        </section>

        {/* Main Action Cards */}
        <section className="px-4 py-12 flex flex-col items-center" aria-label="Quick access">
          <div className="grid grid-cols-1 gap-6 w-full max-w-5xl sm:grid-cols-2">
            {/* Member Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/checkin')}
              onKeyDown={e => handleCardKey(e, () => navigate('/checkin'))}
              aria-label="Member check-in — tap to record your attendance"
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 flex flex-col items-start text-left hover:bg-white/[0.05] hover:border-primary/50 hover:shadow-[0_10px_40px_-10px_rgba(82,71,230,0.3)] hover:-translate-y-2 transition-all duration-500 group cursor-pointer relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none group-hover:bg-primary/40 transition-colors duration-500" aria-hidden="true"></div>
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-4 rounded-2xl mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(82,71,230,0.2)]" aria-hidden="true">
                <span className="material-symbols-outlined text-primary-light text-3xl">person_check</span>
              </div>
              <h3 className="font-display italic text-white text-3xl font-extrabold mb-4">I'm Here</h3>
              <p className="text-slate-300 text-base mb-10 leading-relaxed font-medium">
                Joining a meeting? Tap here to record your attendance securely in seconds using biometrics or NFC.
              </p>
              <span className="mt-auto flex items-center gap-2 text-primary-light font-bold uppercase tracking-widest text-sm group-hover:gap-3 transition-all duration-300">
                Check-in Now
                <span className="material-symbols-outlined text-xl" aria-hidden="true">arrow_forward</span>
              </span>
            </div>

            {/* Admin Card */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/admin')}
              onKeyDown={e => handleCardKey(e, () => navigate('/admin'))}
              aria-label="Admin portal — manage units, members, and events"
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 flex flex-col items-start text-left hover:bg-white/[0.05] hover:border-purple-500/50 hover:shadow-[0_10px_40px_-10px_rgba(168,85,247,0.3)] hover:-translate-y-2 transition-all duration-500 group cursor-pointer relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500/60"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none group-hover:bg-purple-500/40 transition-colors duration-500" aria-hidden="true"></div>
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 p-4 rounded-2xl mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]" aria-hidden="true">
                <span className="material-symbols-outlined text-purple-400 text-3xl">verified_user</span>
              </div>
              <h3 className="font-display italic text-white text-3xl font-extrabold mb-4">Admin Portal</h3>
              <p className="text-slate-300 text-base mb-10 leading-relaxed font-medium">
                Manage your units, members, and events with powerful analytics, real-time tracking, and deep insights.
              </p>
              <span className="mt-auto flex items-center gap-2 text-purple-400 font-bold uppercase tracking-widest text-sm group-hover:gap-3 transition-all duration-300">
                Control Center
                <span className="material-symbols-outlined text-xl" aria-hidden="true">arrow_forward</span>
              </span>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="px-4 py-20 max-w-6xl mx-auto w-full z-10 relative" aria-labelledby="features-heading">
          <div className="text-center mb-16 relative">
            <h2 id="features-heading" className="font-display italic text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 text-4xl sm:text-5xl font-extrabold tracking-[0.05em] mb-4 drop-shadow-sm">Core Security &amp; Features</h2>
            <p className="text-slate-300 font-medium max-w-2xl mx-auto text-lg">Architected for environments where security and precision are non-negotiable.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div className="flex gap-6 rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-primary/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(82,71,230,0.4)] group">
              <div className="bg-white/5 border border-white/10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                <span className="material-symbols-outlined text-3xl text-primary-light">fingerprint</span>
              </div>
              <div>
                <h3 className="text-white text-xl font-bold mb-2">Smart Check-in</h3>
                <p className="text-slate-300 text-base leading-relaxed">One-tap NFC, biometric verification, and dynamic QR codes for secure, fraud-proof entries.</p>
              </div>
            </div>
            <div className="flex gap-6 rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-purple-500/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] group">
              <div className="bg-white/5 border border-white/10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                <span className="material-symbols-outlined text-3xl text-purple-400">security</span>
              </div>
              <div>
                <h3 className="text-white text-xl font-bold mb-2">Device Locking</h3>
                <p className="text-slate-300 text-base leading-relaxed">Tie attendance to specific hardware. Prevent buddy-punching with deep location verification.</p>
              </div>
            </div>
            <div className="flex gap-6 rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-indigo-400/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(129,140,248,0.4)] group">
              <div className="bg-white/5 border border-white/10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                <span className="material-symbols-outlined text-3xl text-indigo-400">distance</span>
              </div>
              <div>
                <h3 className="text-white text-xl font-bold mb-2">Geofencing</h3>
                <p className="text-slate-300 text-base leading-relaxed">Automated check-ins the exact moment members enter your physical site or event perimeter.</p>
              </div>
            </div>
            <div className="flex gap-6 rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-amber-400/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(251,191,36,0.4)] group">
              <div className="bg-white/5 border border-white/10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                <span className="material-symbols-outlined text-3xl text-amber-400">bolt</span>
              </div>
              <div>
                <h3 className="text-white text-xl font-bold mb-2">Auto Engagement</h3>
                <p className="text-slate-300 text-base leading-relaxed">Automated notifications for birthdays, anniversaries, and group-wide critical announcements.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics Preview */}
        <section className="px-4 py-20 relative overflow-hidden" aria-labelledby="insights-heading">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" aria-hidden="true"></div>
          <div className="max-w-4xl mx-auto relative">
            <div className="flex flex-col sm:flex-row items-end justify-between mb-10 gap-4">
              <div>
                <h2 id="insights-heading" className="font-display italic text-white text-4xl font-extrabold mb-2 tracking-[0.05em]">Live Insights</h2>
                <p className="text-slate-300 text-lg">Real-time attendance dashboard</p>
              </div>
              <div className="text-left sm:text-right" aria-live="polite" aria-atomic="true">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400 text-5xl font-black mb-1 block leading-none transition-all duration-300 ease-out">{presenceRate}%</span>
                <p className="text-slate-300 text-xs font-bold uppercase tracking-widest pl-1">Presence Rate</p>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" aria-hidden="true"></div>

              <div className="flex justify-between items-center mb-10 relative z-10">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10" aria-hidden="true">
                    <span className="material-symbols-outlined text-primary-light">groups</span>
                  </div>
                  <span className="font-bold text-lg">Active Headcount</span>
                </div>
                <span className="bg-green-500/20 border border-green-500/30 text-green-400 text-xs px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(74,222,128,0.1)]">+12% vs LW</span>
              </div>

              {/* Chart — decorative, screen readers see the aria-label summary */}
              <div
                role="img"
                aria-label={`Weekly attendance bar chart. Current presence rate: ${presenceRate}%.`}
                className="flex items-end justify-between h-40 gap-3 mb-4 relative z-10"
              >
                {chartBars.map((height, i) => (
                  <div key={i} className="relative w-full h-full flex items-end" aria-hidden="true">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ease-out ${i === activeIndex ? 'bg-gradient-to-t from-primary to-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-y-[1.05]' : 'bg-white/10 hover:bg-primary'} origin-bottom`}
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-widest relative z-10" aria-hidden="true">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Every Group */}
        <section className="px-4 py-24 text-center max-w-6xl mx-auto w-full relative z-10" aria-labelledby="groups-heading">
          <div className="text-center mb-16 relative">
            <h2 id="groups-heading" className="font-display italic text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 text-4xl sm:text-5xl font-extrabold tracking-[0.05em] mb-4 drop-shadow-sm">Built for Every Elite Group</h2>
            <p className="text-slate-300 font-medium max-w-2xl mx-auto text-lg">Rollcally adapts perfectly to your organizational hierarchy, whether you're a global titan or a specialized task force.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left relative z-10">
            {/* Corporations */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/admin/signup')}
              onKeyDown={e => handleCardKey(e, () => navigate('/admin/signup'))}
              aria-label="Corporations — explore Rollcally for large enterprises"
              className="group rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-primary/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(82,71,230,0.4)] flex flex-col h-full cursor-pointer hover:-translate-y-2 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" aria-hidden="true">
                <span className="material-symbols-outlined text-8xl text-white">domain</span>
              </div>
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <span className="material-symbols-outlined">domain</span>
                </div>
              </div>
              <h3 className="font-display italic text-white text-3xl font-extrabold mb-4 tracking-[0.05em] relative z-10">Corporations</h3>
              <p className="text-slate-300 text-lg mb-8 relative z-10 flex-grow">Perfectly scaled attendance and geo-tracking for massive global enterprises.</p>
              <div className="flex items-center text-primary font-bold group-hover:text-purple-400 transition-colors relative z-10 mt-auto">
                Explore Solutions <span className="material-symbols-outlined ml-2 group-hover:translate-x-2 transition-transform" aria-hidden="true">arrow_forward</span>
              </div>
            </div>

            {/* Non-profits */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/admin/signup')}
              onKeyDown={e => handleCardKey(e, () => navigate('/admin/signup'))}
              aria-label="Non-profits — explore Rollcally for volunteer organizations"
              className="group rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-purple-500/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] flex flex-col h-full cursor-pointer hover:-translate-y-2 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500/60"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" aria-hidden="true">
                <span className="material-symbols-outlined text-8xl text-purple-400">volunteer_activism</span>
              </div>
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <span className="material-symbols-outlined">volunteer_activism</span>
                </div>
              </div>
              <h3 className="font-display italic text-white text-3xl font-extrabold mb-4 tracking-[0.05em] relative z-10">Non-profits</h3>
              <p className="text-slate-300 text-lg mb-8 relative z-10 flex-grow">Engage volunteers and track event participation with effortless precision.</p>
              <div className="flex items-center text-purple-400 font-bold group-hover:text-purple-300 transition-colors relative z-10 mt-auto">
                Explore Solutions <span className="material-symbols-outlined ml-2 group-hover:translate-x-2 transition-transform" aria-hidden="true">arrow_forward</span>
              </div>
            </div>

            {/* Large Groups */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate('/admin/signup')}
              onKeyDown={e => handleCardKey(e, () => navigate('/admin/signup'))}
              aria-label="Large groups — explore Rollcally for high-volume membership"
              className="group rounded-3xl p-8 bg-surface-low/80 backdrop-blur-xl border border-white/10 hover:bg-surface-highest/90 hover:border-blue-400/50 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(96,165,250,0.4)] flex flex-col h-full cursor-pointer hover:-translate-y-2 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" aria-hidden="true">
                <span className="material-symbols-outlined text-8xl text-blue-400">groups</span>
              </div>
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <span className="material-symbols-outlined">groups</span>
                </div>
              </div>
              <h3 className="font-display italic text-white text-3xl font-extrabold mb-4 tracking-[0.05em] relative z-10">Large Groups</h3>
              <p className="text-slate-300 text-lg mb-8 relative z-10 flex-grow">Handle thousands of members simultaneously without breaking a sweat.</p>
              <div className="flex items-center text-blue-400 font-bold group-hover:text-blue-300 transition-colors relative z-10 mt-auto">
                Explore Solutions <span className="material-symbols-outlined ml-2 group-hover:translate-x-2 transition-transform" aria-hidden="true">arrow_forward</span>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA — reuses preloaded hero bg via shared constant */}
        <section className="w-full relative py-14 sm:py-20 bg-gradient-to-br from-primary to-purple-600 text-center text-white flex flex-col items-center shadow-[0_20px_50px_-10px_rgba(82,71,230,0.5)] overflow-hidden mt-12 mb-[-40px]">
          <div className={`absolute inset-0 ${HERO_BG_CLASS} bg-cover bg-center opacity-15 mix-blend-screen pointer-events-none`} aria-hidden="true"></div>
          <div className="relative z-10 max-w-5xl mx-auto px-4 flex flex-col items-center gap-8">
            <h2 className="font-display italic text-5xl sm:text-7xl font-black leading-tight tracking-[0.05em] drop-shadow-lg">Elevate Your<br />Organization</h2>
            <p className="text-white/90 max-w-xl text-lg sm:text-xl font-medium drop-shadow">Join the elite groups who have already transformed their accountability and engagement with Rollcally.</p>
            <button onClick={() => navigate('/admin/signup')} className="w-full max-w-md bg-white text-slate-900 rounded-full h-[72px] font-bold text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all tracking-wide mt-4">
              Create Your Workspace
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 pt-20 pb-32 md:pb-16 mt-10 bg-[#020617]/50 backdrop-blur-md relative z-10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12 md:gap-8">
            <div className="flex flex-col gap-6 max-w-xs">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="" className="h-8 w-8 object-contain" aria-hidden="true" />
                <span className="text-white text-xl font-display italic font-black tracking-tight">Rollcally</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed font-medium">The premium standard for organizational attendance and member engagement analytics.</p>
              <div className="flex gap-4 pt-2">
                <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 border border-white/5" title="Website" aria-label="Website (coming soon)"><span className="material-symbols-outlined text-xl" aria-hidden="true">public</span></span>
                <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 border border-white/5" title="Email" aria-label="Email (coming soon)"><span className="material-symbols-outlined text-xl" aria-hidden="true">alternate_email</span></span>
                <span className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 border border-white/5" title="Reviews" aria-label="Reviews (coming soon)"><span className="material-symbols-outlined text-xl" aria-hidden="true">share_reviews</span></span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:gap-24">
              <div className="flex flex-col gap-6">
                <h4 className="font-display italic font-extrabold text-white text-lg tracking-wide">Product</h4>
                <ul className="flex flex-col gap-4 text-slate-400 text-sm font-medium">
                  <li><span className="cursor-default">Features</span></li>
                  <li><span className="cursor-default">Security</span></li>
                  <li><span className="cursor-default">Pricing</span></li>
                </ul>
              </div>
              <div className="flex flex-col gap-6">
                <h4 className="font-display italic font-extrabold text-white text-lg tracking-wide">Company</h4>
                <ul className="flex flex-col gap-4 text-slate-400 text-sm font-medium">
                  <li><span className="cursor-default">About</span></li>
                  <li><span className="cursor-default">Contact</span></li>
                  <li><span className="cursor-default">Privacy</span></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-20 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">© {new Date().getFullYear()} Rollcally Inc. All rights reserved.</p>
            <div className="flex gap-8 text-xs font-bold tracking-widest uppercase text-slate-400">
              <span className="cursor-default">Status</span>
              <button onClick={() => navigate('/help')} className="hover:text-white transition-colors">User Guide</button>
              <span className="cursor-default">Terms</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile bottom nav — Home navigates, others are visual placeholders */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#020617]/80 backdrop-blur-3xl px-4 pb-8 pt-4 justify-around" aria-label="Mobile navigation">
        <button className="flex flex-col items-center gap-1 text-primary-light bg-transparent border-0" onClick={() => navigate('/')} aria-label="Home">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">home</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 bg-transparent border-0" onClick={() => navigate('/admin')} aria-label="Insights">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">monitoring</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Insights</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 bg-transparent border-0" onClick={() => navigate('/admin/login')} aria-label="Sign in">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">verified_user</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Security</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 bg-transparent border-0" onClick={() => navigate('/help')} aria-label="User guide">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">settings</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Menu</span>
        </button>
      </nav>
    </div>
  )
}
