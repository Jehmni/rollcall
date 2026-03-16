import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-3 border-b border-slate-200 dark:border-primary/20 justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg">
            <span className="material-symbols-outlined text-white text-2xl">grid_view</span>
          </div>
          <h2 className="text-slate-900 dark:text-white text-xl font-extrabold tracking-tight">Rollcally</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/login')} className="text-primary font-bold text-sm">Login</button>
          <button onClick={() => navigate('/admin/signup')} className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-primary/20">Join</button>
        </div>
      </nav>

      <main className="flex flex-col min-h-screen pb-24 sm:pb-0">
        {/* Hero Section */}
        <section className="@container">
          <div className="p-4 @[480px]:p-6">
            <div 
              className="relative flex min-h-[520px] flex-col gap-6 bg-cover bg-center bg-no-repeat rounded-2xl items-center justify-center p-6 text-center overflow-hidden" 
              style={{
                backgroundImage: 'linear-gradient(rgba(18, 17, 33, 0.7) 0%, rgba(18, 17, 33, 0.95) 100%), url("/images/hero_bg.jpg")'
              }}
            >
              <h1 className="text-white text-4xl font-black leading-tight tracking-tight @[480px]:text-6xl max-w-2xl">
                Attendance Reimagined for Elite Organizations
              </h1>
              <p className="text-slate-300 text-base font-normal leading-relaxed @[480px]:text-lg max-w-xl">
                Experience the pinnacle of smart check-ins, biometrics, and real-time geofencing. Built for the modern enterprise that demands precision.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 flex flex-col items-center">
          <div className="grid grid-cols-1 gap-6 w-full max-w-4xl sm:grid-cols-2">
            {/* Member Card */}
            <div 
              onClick={() => navigate('/checkin')}
              className="bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 rounded-[2rem] p-10 flex flex-col items-start text-left hover:border-primary/30 transition-all group cursor-pointer"
            >
              <div className="bg-slate-100 dark:bg-primary/10 p-4 rounded-2xl mb-8 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-3xl">person_check</span>
              </div>
              <h3 className="text-slate-900 dark:text-white text-3xl font-black mb-4">I'm Here</h3>
              <p className="text-slate-500 dark:text-slate-400 text-base mb-10 leading-relaxed">
                Joining a meeting? Tap here to record your attendance in seconds.
              </p>
              <button className="mt-auto flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm">
                Check-in Now
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </div>

            {/* Admin Card */}
            <div 
              onClick={() => navigate('/admin')}
              className="bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 rounded-[2rem] p-10 flex flex-col items-start text-left hover:border-primary/30 transition-all group cursor-pointer"
            >
              <div className="bg-slate-100 dark:bg-primary/10 p-4 rounded-2xl mb-8 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
              </div>
              <h3 className="text-slate-900 dark:text-white text-3xl font-black mb-4">Admin Portal</h3>
              <p className="text-slate-500 dark:text-slate-400 text-base mb-10 leading-relaxed">
                Manage your units, members, and events with powerful analytics.
              </p>
              <button className="mt-auto flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm">
                Control Center
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="px-4 py-12 max-w-5xl mx-auto w-full">
          <div className="mb-10">
            <h2 className="text-slate-900 dark:text-white text-3xl font-black tracking-tight mb-2 uppercase italic tracking-tighter">Core Security & Features</h2>
            <div className="h-1 w-12 bg-primary rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Feature 1 */}
            <div className="flex flex-col gap-4 rounded-2xl p-6 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 hover:border-primary/40 transition-all">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">fingerprint</span>
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-2">Smart Check-in</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  One-tap NFC, biometric verification, and dynamic QR codes for secure, fraud-proof entries.
                </p>
              </div>
            </div>
            {/* Feature 2 */}
            <div className="flex flex-col gap-4 rounded-2xl p-6 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 hover:border-primary/40 transition-all">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">security</span>
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-2">Device Locking</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Tie attendance to specific hardware. Prevent buddy-punching with deep location verification.
                </p>
              </div>
            </div>
            {/* Feature 3 */}
            <div className="flex flex-col gap-4 rounded-2xl p-6 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 hover:border-primary/40 transition-all">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">distance</span>
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-2">Geofencing</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Automated check-ins as members enter your physical site or event perimeter.
                </p>
              </div>
            </div>
            {/* Feature 4 */}
            <div className="flex flex-col gap-4 rounded-2xl p-6 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 hover:border-primary/40 transition-all">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">celebration</span>
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-2">Auto Engagement</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  Automated notifications for birthdays, anniversaries, and group-wide announcements.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics Preview */}
        <section className="px-4 py-12 bg-slate-100 dark:bg-white/5">
          <div className="max-w-md mx-auto">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-slate-900 dark:text-white text-2xl font-black">Live Insights</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Real-time attendance dashboard</p>
              </div>
              <div className="text-right">
                <span className="text-primary text-3xl font-black">94%</span>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">Presence Rate</p>
              </div>
            </div>
            <div className="bg-white dark:bg-background-dark rounded-2xl border border-slate-200 dark:border-primary/20 p-6 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2 text-brand-text dark:text-white">
                  <span className="material-symbols-outlined text-primary">groups</span>
                  <span className="font-bold">Active Headcount</span>
                </div>
                <span className="bg-green-500/10 text-green-500 text-xs px-2 py-0.5 rounded-full font-bold">+12% vs LW</span>
              </div>
              <div className="flex items-end justify-between h-32 gap-2 mb-4">
                <div className="bg-primary/20 w-full rounded-t-lg h-[40%]"></div>
                <div className="bg-primary/20 w-full rounded-t-lg h-[60%]"></div>
                <div className="bg-primary/20 w-full rounded-t-lg h-[55%]"></div>
                <div className="bg-primary/20 w-full rounded-t-lg h-[80%]"></div>
                <div className="bg-primary/20 w-full rounded-t-lg h-[70%]"></div>
                <div className="bg-primary w-full rounded-t-lg h-[95%]"></div>
                <div className="bg-primary/40 w-full rounded-t-lg h-[30%]"></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-background-dark rounded-xl border border-slate-200 dark:border-primary/10">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <div className="flex-1 text-sm font-medium">Global Sales Summit</div>
                <div className="text-sm font-black">412 / 450</div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-background-dark rounded-xl border border-slate-200 dark:border-primary/10">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="flex-1 text-sm font-medium">Weekly HQ Sync</div>
                <div className="text-sm font-black">88 / 120</div>
              </div>
            </div>
          </div>
        </section>

        {/* Built for Every Group */}
        <section className="px-4 py-16 text-center max-w-5xl mx-auto w-full">
          <h2 className="text-slate-900 dark:text-white text-3xl font-black mb-4 uppercase italic tracking-tighter">Built for Every Elite Group</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-12 max-w-lg mx-auto">Rollcally adapts to your organizational hierarchy, whether you're a global titan or a specialized group.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="relative group overflow-hidden rounded-2xl h-48 flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url("/images/corporations.jpg")' }}></div>
              <div className="absolute inset-0 bg-primary/60 mix-blend-multiply opacity-80"></div>
              <h3 className="relative text-white text-2xl font-black uppercase italic tracking-tighter">Corporations</h3>
            </div>
            <div className="relative group overflow-hidden rounded-2xl h-48 flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url("/images/nonprofits.jpg")' }}></div>
              <div className="absolute inset-0 bg-primary/60 mix-blend-multiply opacity-80"></div>
              <h3 className="relative text-white text-2xl font-black uppercase italic tracking-tighter">Non-profits</h3>
            </div>
            <div className="relative group overflow-hidden rounded-2xl h-48 flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url("/images/large_groups.jpg")' }}></div>
              <div className="absolute inset-0 bg-primary/60 mix-blend-multiply opacity-80"></div>
              <h3 className="relative text-white text-2xl font-black uppercase italic tracking-tighter">Large Groups</h3>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-12 max-w-4xl mx-auto w-full">
          <div className="bg-primary rounded-[3rem] p-10 text-center text-white flex flex-col items-center gap-6 shadow-2xl shadow-primary/40">
            <h2 className="text-3xl font-black leading-tight uppercase italic tracking-tighter">Ready to elevate your organization?</h2>
            <p className="text-white/80 max-w-md">Join the elite groups who have already transformed their accountability and engagement with Rollcally.</p>
            <button onClick={() => navigate('/admin/signup')} className="w-full max-w-sm bg-white text-primary rounded-2xl h-14 font-black text-lg shadow-lg hover:scale-105 active:scale-95 transition-all uppercase tracking-widest">Get Started</button>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-100 dark:bg-background-dark border-t border-slate-200 dark:border-primary/10 px-6 pt-16 pb-32 md:pb-16">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12 md:gap-8">
            <div className="flex flex-col gap-4 max-w-xs">
              <div className="flex items-center gap-2">
                <div className="bg-primary p-1.5 rounded-lg">
                  <span className="material-symbols-outlined text-white text-lg">grid_view</span>
                </div>
                <h2 className="text-slate-900 dark:text-white text-xl font-extrabold tracking-tight">Rollcally</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">The premium standard for organizational attendance and member engagement analytics.</p>
              <div className="flex gap-4 pt-4">
                <a className="text-slate-400 hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">public</span></a>
                <a className="text-slate-400 hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">alternate_email</span></a>
                <a className="text-slate-400 hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined">share_reviews</span></a>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:gap-20">
              <div className="flex flex-col gap-4">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Product</h4>
                <ul className="flex flex-col gap-3 text-slate-500 dark:text-slate-400 text-sm">
                  <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
                  <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Company</h4>
                <ul className="flex flex-col gap-3 text-slate-500 dark:text-slate-400 text-sm">
                  <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
                  <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
                  <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-200 dark:border-primary/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">© {new Date().getFullYear()} ROLLCALLY INC. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-6 text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">
              <a href="#" className="hover:text-primary transition-colors">Status</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
            </div>
          </div>
        </footer>
      </main>

      {/* Bottom Navigation Bar (Mobile) - Visible only on mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 dark:border-primary/20 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl px-4 pb-6 pt-3">
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-primary" href="#">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <p className="text-[10px] font-bold uppercase tracking-wider">Home</p>
        </a>
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors" href="#">
          <span className="material-symbols-outlined text-2xl">monitoring</span>
          <p className="text-[10px] font-bold uppercase tracking-wider">Insights</p>
        </a>
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors" href="#">
          <span className="material-symbols-outlined text-2xl">verified_user</span>
          <p className="text-[10px] font-bold uppercase tracking-wider">Security</p>
        </a>
        <a className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors" href="#">
          <span className="material-symbols-outlined text-2xl">settings</span>
          <p className="text-[10px] font-bold uppercase tracking-wider">Settings</p>
        </a>
      </div>
    </div>
  )
}
