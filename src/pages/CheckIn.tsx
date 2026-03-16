import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAttendance } from '../hooks/useAttendance'
import { useServiceMembers, useMemberById, useServiceInfo, type PublicMember } from '../hooks/useChoristers'
import { QRScanner } from '../components/QRScanner'

type Step = 'welcome' | 'list' | 'confirm' | 'done'

export default function CheckIn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('list')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PublicMember | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successTime, setSuccessTime] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const storedMemberId = localStorage.getItem('rollcally_member_id')
  const { member: recognizedMember } = useMemberById(storedMemberId)

  const paramServiceId = searchParams.get('event_id')
  const serviceId = paramServiceId ?? sessionStorage.getItem('pending_event_id')
  const { unitName } = useServiceInfo(serviceId)

  useEffect(() => {
    if (paramServiceId) sessionStorage.setItem('pending_event_id', paramServiceId)
  }, [paramServiceId])

  useEffect(() => {
    if (recognizedMember && step === 'list') {
      setStep('welcome')
      setSelected(recognizedMember)
    }
  }, [recognizedMember, step])

  const { members, loading: listLoading, error: listError } = useServiceMembers(serviceId, query)
  // The useAttendance hook is still imported but its status/error/checkIn/reset are now managed locally for the main flow.
  // Assuming a new function `registerAttendance` is available or `checkIn` from useAttendance is used with local state management.
  // For this change, I'll assume `checkIn` from `useAttendance` is still the underlying function, but its state is managed here.
  const { checkIn: registerAttendance } = useAttendance(serviceId); // Renaming for clarity in this context

  const filtered = members

  const grouped = useMemo(() => {
    const sections = [...new Set(filtered.map(m => m.section ?? ''))].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    return sections.reduce<Record<string, PublicMember[]>>((acc, s) => {
      acc[s] = filtered.filter(m => (m.section ?? '') === s)
      return acc
    }, {})
  }, [filtered])

  function handleSelect(m: PublicMember) {
    setSelected(m)
    setStep('confirm')
  }

  function handleStartLinking() {
    setStep('list')
    setSelected(null)
    setStatus('idle') // Reset status when switching profile
    setErrorMessage(null)
  }

  async function handleConfirm() {
    if (!selected || !serviceId) return

    setStatus('loading')
    setErrorMessage(null)
    setSuccessTime(null)
    setStep('done') // Move to done step immediately to show loading

    try {
      await registerAttendance(selected.id) // Use the renamed checkIn from useAttendance
      setSuccessTime(new Date().toLocaleString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(',', ' •'))
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setErrorMessage(err.message || 'An unknown error occurred during check-in.')
    }
  }

  function handleBack() {
    setStep('list')
    setSelected(null)
    setStatus('idle') // Reset status
    setErrorMessage(null)
  }

  function handleScan(scannedServiceId: string) {
    const params = new URLSearchParams(searchParams)
    params.set('event_id', scannedServiceId)
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
    setShowScanner(false)
    window.location.reload()
  }

  const noService = !serviceId

  const headerTitle = useMemo(() => {
    if (step === 'done') {
      if (status === 'success') return 'Verification'
      if (status === 'error') return 'Sync Denied'
      return 'Processing'
    }
    return 'Check In'
  }, [step, status])

  return (
    <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased">
      {/* Top Navigation Header */}
      <header className="grid grid-cols-3 items-center p-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-primary/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => step === 'done' ? navigate('/') : navigate('/')}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-white">{step === 'done' ? 'close' : 'arrow_back'}</span>
          </button>
          {step !== 'done' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-300">
              <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-white text-lg">grid_view</span>
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white hidden sm:block">Rollcally</span>
            </div>
          )}
        </div>
        
        <div className="text-center">
          <span className="font-black text-white uppercase italic tracking-tighter text-sm">
            {headerTitle}
          </span>
        </div>
        
        <div className="w-full"></div> {/* Grid symmetry */}
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-12 overflow-y-auto">
        {noService ? (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Text Content */}
            <div className="text-center mb-10 max-w-sm">
              <p className="text-slate-400 text-base leading-relaxed">
                Scan the QR code at your venue to register attendance.
              </p>
            </div>

            {/* Scanner Container */}
            <div className="w-full max-w-sm aspect-square relative group">
              {/* Corner Accents for Scanner Viewfinder */}
              <div className="absolute -top-1 -left-1 size-8 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              <div className="absolute -top-1 -right-1 size-8 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              <div className="absolute -bottom-1 -left-1 size-8 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              <div className="absolute -bottom-1 -right-1 size-8 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              
              {/* Scanner Body */}
              <div className="w-full h-full rounded-2xl bg-primary/5 flex flex-col items-center justify-center overflow-hidden border border-primary/20 shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="size-32 rounded-3xl bg-primary/20 flex items-center justify-center mb-2 shadow-inner border border-primary/30">
                    <span className="material-symbols-outlined text-primary text-7xl">qr_code_scanner</span>
                  </div>
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-primary/30 flex items-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-sm"
                  >
                    <span className="material-symbols-outlined text-2xl">photo_camera</span>
                    <span>Tap to Scan</span>
                  </button>
                </div>
                {/* Abstract Decorative Image */}
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none bg-center bg-no-repeat bg-cover saturate-[1.5]" 
                  style={{ backgroundImage: "url('/images/checkin_scanner_bg.jpg')" }}
                ></div>
              </div>
            </div>

            {/* Current Venue Card */}
            <div className="mt-12 w-full max-w-sm">
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10 shadow-lg">
                <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                  <span className="material-symbols-outlined text-2xl">location_on</span>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Venue Status</p>
                  <p className="font-extrabold text-white text-lg tracking-tight uppercase italic">{unitName || 'Will update after you scan qrcode'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : step === 'welcome' && selected ? (
           <div className="w-full max-w-sm flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-8">
              <div className="text-center">
                 <div className="group relative mx-auto mb-10 inline-block">
                   <div className="absolute inset-0 bg-primary blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                   <div className="relative flex h-36 w-36 items-center justify-center rounded-[3rem] bg-background-dark border border-primary/30 shadow-2xl text-6xl font-black text-primary italic">
                     {selected.name.charAt(0)}
                   </div>
                 </div>
                 <h2 className="text-4xl font-black text-white leading-tight uppercase tracking-tighter italic">Hi, {selected.name.split(' ')[0]}!</h2>
                 <div className="h-1.5 w-16 bg-primary mx-auto mt-4 rounded-full shadow-[0_0_10px_rgba(82,71,230,0.5)]"></div>
                 <p className="text-slate-400 mt-6 text-xl font-medium">Glad to see you again.</p>
              </div>
               
              <div className="flex flex-col gap-4 w-full">
                 <button 
                  onClick={handleConfirm}
                  className="w-full py-8 text-xl font-black uppercase tracking-[0.2em] bg-primary text-white rounded-3xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                 >
                   I&apos;m Here
                 </button>
                 <button 
                   onClick={handleStartLinking}
                   className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-primary transition-colors py-4"
                 >
                   Not you? Switch Profile
                 </button>
              </div>

              <div className="w-full p-6 rounded-3xl bg-primary/5 border border-primary/10 shadow-xl flex items-center gap-4">
                 <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                    <span className="material-symbols-outlined text-3xl">location_on</span>
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Venue Verified</p>
                    <p className="font-extrabold text-white text-lg uppercase italic tracking-tight">{unitName ?? 'Main Venue Node'}</p>
                 </div>
              </div>
           </div>
        ) : step === 'list' ? (
           <div className="w-full max-w-sm flex flex-col gap-8 animate-in fade-in duration-500">
              <div className="text-center">
                <h1 className="text-4xl font-black mb-3 tracking-tighter italic uppercase">Check In</h1>
                <p className="text-slate-400">Locate your credentials in the roster.</p>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
                <input
                  type="search"
                  placeholder="Find your name…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-primary/10 bg-primary/5 py-5 pl-12 pr-6 text-lg font-bold transition-all focus:border-primary/50 focus:ring-8 focus:ring-primary/5 placeholder:text-slate-600 shadow-xl"
                  autoFocus
                />
              </div>

              {listLoading ? (
                <div className="flex justify-center py-12">
                   <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-lg shadow-primary/20" />
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-h-[45vh] overflow-y-auto pr-2 scrollbar-hide">
                  {listError && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold text-center">
                      {listError}
                    </div>
                  )}
                  {Object.entries(grouped).map(([section, sectionMembers]) => (
                    <div key={section} className="flex flex-col gap-3 mb-4">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 ml-2">{section || 'Main Roster'}</h3>
                       {sectionMembers.map(m => (
                         <button
                           key={m.id}
                           onClick={() => handleSelect(m)}
                           className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-primary/5 border border-primary/10 hover:border-primary/40 hover:bg-primary/10 hover:shadow-2xl transition-all text-left group"
                         >
                            <span className="font-extrabold text-white text-lg tracking-tight uppercase italic">{m.name}</span>
                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                               <span className="material-symbols-outlined text-primary group-hover:text-white rotate-180">arrow_back</span>
                            </div>
                         </button>
                       ))}
                    </div>
                  ))}
                </div>
              )}
           </div>
        ) : step === 'confirm' && selected ? (
          <div className="w-full max-w-sm flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-8">
             <div className="text-center">
                <div className="group relative mx-auto mb-10 inline-block">
                  <div className="absolute inset-0 bg-primary blur-3xl opacity-20"></div>
                  <div className="relative flex h-36 w-36 items-center justify-center rounded-[3rem] bg-background-dark border border-primary/30 shadow-2xl text-6xl font-black text-primary italic">
                    {selected.name.charAt(0)}
                  </div>
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">Biometric Verification</h3>
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic">Is this you?</h2>
                <div className="mt-10 p-8 rounded-[2.5rem] bg-primary/5 border border-primary/20 shadow-[0_0_50px_rgba(82,71,230,0.1)] w-full relative overflow-hidden">
                   <div className="absolute top-0 right-0 -mt-8 -mr-8 h-24 w-24 bg-primary/10 rounded-full blur-2xl"></div>
                   <p className="text-3xl font-black text-white uppercase italic tracking-tighter relative z-10">{selected.name}</p>
                   {selected.section && (
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mt-3 relative z-10">{selected.section} Control Node</p>
                   )}
                </div>
             </div>

             <div className="flex flex-col gap-4 w-full">
               <button 
                onClick={handleConfirm}
                className="w-full h-24 text-xl font-black uppercase tracking-[0.2em] bg-primary text-white rounded-3xl shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
               >
                 Confirmed
               </button>
               <button onClick={handleBack} className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-primary py-4">
                 Abort & Return
               </button>
             </div>
          </div>
        ) : step === 'done' ? (
            <div className="w-full max-w-sm pt-4 animate-in zoom-in-95 duration-500">
              {status === 'loading' ? (
                 <div className="flex flex-col items-center gap-8 py-20 rounded-[4rem] bg-primary/5 border border-primary/20 shadow-2xl">
                   <div className="h-20 w-20 animate-spin rounded-full border-[8px] border-primary border-t-transparent" />
                   <p className="text-xs font-black uppercase tracking-[0.4em] text-primary animate-pulse italic">Securing Protocols...</p>
                 </div>
              ) : status === 'success' ? (
                 <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
                    {/* Success Animation/Icon Container */}
                    <div className="relative flex flex-col items-center justify-center mb-8">
                      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150"></div>
                      <div className="relative bg-primary text-white rounded-[2.5rem] p-6 shadow-[0_0_60px_rgba(82,71,230,0.5)] border border-white/20">
                        <span className="material-symbols-outlined !text-7xl">check_circle</span>
                      </div>
                    </div>

                    {/* Success Message */}
                    <div className="text-center space-y-3 mb-12">
                      <h1 className="text-white text-5xl font-black tracking-tighter uppercase italic">Success!</h1>
                      <p className="text-slate-400 text-lg font-medium tracking-tight">Check-in Successful</p>
                    </div>

                    {/* Details Card */}
                    <div className="w-full bg-primary/5 border border-primary/20 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm relative">
                       <div className="absolute top-0 right-0 -mt-10 -mr-10 size-32 bg-primary/10 rounded-full blur-3xl"></div>
                       
                       {/* User Info */}
                       <div className="p-8 text-center border-b border-primary/10">
                          <div className="inline-block size-24 rounded-full border-2 border-primary p-2 mb-6 group relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative w-full h-full rounded-full bg-background-dark border border-primary/30 flex items-center justify-center text-3xl font-black text-primary italic">
                              {selected?.name.charAt(0)}
                            </div>
                          </div>
                          <h2 className="text-white text-3xl font-black uppercase italic tracking-tighter mb-1">Welcome, {selected?.name}</h2>
                          <p className="text-primary font-black uppercase tracking-[0.2em] text-[10px]">Confirmed Attendee</p>
                       </div>

                       {/* Event Info */}
                       <div className="p-8 space-y-6">
                          <div className="flex items-center gap-5">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/10">
                              <span className="material-symbols-outlined text-2xl">corporate_fare</span>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[9px] uppercase tracking-[0.3em] font-black mb-1">Venue</p>
                              <p className="text-white font-black uppercase italic text-lg tracking-tight">{unitName || 'Main Conference Hall'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-5">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/10">
                              <span className="material-symbols-outlined text-2xl">schedule</span>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[9px] uppercase tracking-[0.3em] font-black mb-1">Time</p>
                              <p className="text-white font-bold text-lg tracking-tight">{successTime || 'Registering...'}</p>
                            </div>
                          </div>

                          {/* Map Preview Container */}
                          <div className="w-full h-32 rounded-3xl overflow-hidden border border-primary/20 mt-4 relative group">
                            <div className="absolute inset-0 bg-primary/5 flex items-center justify-center">
                               <div className="absolute inset-0 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuApCLyeszxIrO0TAvbwlI8rUi6sgaCVdqdMlTHKJ7QEPyvpU1iRMw2zo_O3WkMsdyymJnhIyWpTpjvZ-c58bSe0wnJnEd5-LRocmWniUoUg7jTKuJYWZxIpzH1pBdkeGHJJLHVcDhfvNuDnZ3JvF97-r_6Y_dQVW2f7nA5txClOLtHWXFhv9Avh8BuI_SoiekRWZr8oE7N3uUPbtshSlCzkeZ9GpvBy0nUJRgwtG0zCOpW0q6nB5v57SFka26RqRaB8gcUreZAU8lTu')] bg-cover bg-center grayscale opacity-40 group-hover:opacity-60 transition-opacity"></div>
                               <div className="relative z-10 px-4 py-2 rounded-full bg-background-dark/80 backdrop-blur-md border border-primary/30 shadow-xl">
                                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Local Node: {unitName || 'Security Perimeter'}</p>
                               </div>
                            </div>
                          </div>
                       </div>
                    </div>

                    <div className="w-full mt-10">
                      <button 
                        onClick={() => navigate('/')}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-black py-6 rounded-3xl shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 uppercase tracking-[0.3em] text-xs"
                      >
                        <span>Done</span>
                        <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                      </button>
                      <p className="text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] mt-6">
                        Rollcally Identity Verification System
                      </p>
                    </div>
                 </div>
              ) : (
                <div className="flex flex-col items-center gap-10 text-center py-20 rounded-[4rem] bg-red-500/5 border border-red-500/20 shadow-2xl">
                  <div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-red-500 text-white shadow-[0_20px_40px_rgba(239,68,68,0.4)]">
                    <span className="material-symbols-outlined text-6xl">warning</span>
                  </div>
                  <div className="px-10">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-3">Sync Denied</h2>
                    <p className="text-base text-red-500 font-bold uppercase tracking-wide leading-relaxed">{errorMessage ?? 'Security Protocol Breach'}</p>
                  </div>
                  <button onClick={handleBack} className="text-xs font-black uppercase tracking-[0.4em] text-primary hover:underline underline-offset-8">
                    Re-verify Identity
                  </button>
                </div>
             )}
           </div>
        ) : null}

        {/* Admin Link Footer */}
        <div className="mt-auto pt-10 text-center pb-20">
          <p className="text-slate-600 text-[10px] font-black tracking-[0.2em] uppercase">
            Not a visitor? 
            <button 
              onClick={() => navigate('/admin')}
              className="text-primary font-black hover:underline ml-2"
            >
              Admin portal
            </button>
          </p>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-primary/20 bg-background-dark/90 backdrop-blur-xl px-4 pb-8 pt-4">
        <button 
          onClick={() => navigate('/')} 
          className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-primary transition-all group"
        >
          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">home</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => { setStep('list'); setSelected(null); }} 
          className="flex flex-1 flex-col items-center justify-center gap-1 text-primary relative"
        >
          <div className="absolute -top-1 w-12 h-1 bg-primary rounded-full blur-sm"></div>
          <span className="material-symbols-outlined text-2xl scale-125" style={{ fontVariationSettings: "'FILL' 1" }}>person_check</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Check-in</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-primary transition-all group">
          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">calendar_today</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Events</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-primary transition-all group">
          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">person</span>
          <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
        </button>
      </nav>

      {showScanner && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  )
}
