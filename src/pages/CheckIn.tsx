import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { 
  CheckCircle, 
  AlertCircle, 
  Search, 
  ArrowLeft, 
  QrCode, 
  Camera, 
  MapPin, 
  Home, 
  Calendar, 
  User,
  Scan
} from 'lucide-react'
import { useAttendance } from '../hooks/useAttendance'
import { useServiceMembers, useMemberById, useServiceInfo, type PublicMember } from '../hooks/useChoristers'
import { Button } from '../components/ui/Button'
import { QRScanner } from '../components/QRScanner'

type Step = 'welcome' | 'list' | 'confirm' | 'done'

export default function CheckIn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('list')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PublicMember | null>(null)
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
  const { status, checkedInName, errorMessage, checkIn, reset } = useAttendance(serviceId)

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
  }

  async function handleConfirm() {
    if (!selected) return
    await checkIn(selected.id)
    setStep('done')
  }

  function handleBack() {
    setStep('list')
    setSelected(null)
    reset()
  }

  function handleScan(scannedServiceId: string) {
    const params = new URLSearchParams(searchParams)
    params.set('event_id', scannedServiceId)
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
    setShowScanner(false)
    window.location.reload()
  }

  const noService = !serviceId

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f8] text-slate-900 font-display">
      {/* Top Navigation Header */}
      <header className="flex items-center justify-between p-4 sticky top-0 z-10 bg-white/80 backdrop-blur-md">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center justify-center p-2 rounded-full hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-900" />
        </button>
        <div className="flex items-center gap-2">
          <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center">
            <Scan className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Rollcally</span>
        </div>
        <div className="w-10"></div> {/* Spacer for symmetry */}
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-12 overflow-y-auto">
        {/* Step based content */}
        
        {noService ? (
          <>
            <div className="text-center mb-10 max-w-sm animate-in fade-in duration-700">
              <h1 className="text-3xl font-bold mb-3 tracking-tight">Check In</h1>
              <p className="text-slate-600 text-base leading-relaxed">
                Scan the QR code at your venue to record attendance.
              </p>
            </div>

            <div className="w-full max-w-sm aspect-square relative group">
              {/* Corner Accents for Scanner Viewfinder */}
              <div className="absolute -top-1 -left-1 size-8 border-t-4 border-l-4 border-brand-primary rounded-tl-xl"></div>
              <div className="absolute -top-1 -right-1 size-8 border-t-4 border-r-4 border-brand-primary rounded-tr-xl"></div>
              <div className="absolute -bottom-1 -left-1 size-8 border-b-4 border-l-4 border-brand-primary rounded-bl-xl"></div>
              <div className="absolute -bottom-1 -right-1 size-8 border-b-4 border-r-4 border-brand-primary rounded-br-xl"></div>
              
              {/* Scanner Body */}
              <div className="w-full h-full rounded-xl bg-white flex flex-col items-center justify-center overflow-hidden border border-slate-200 shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-transparent"></div>
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="size-32 rounded-3xl bg-brand-primary/10 flex items-center justify-center mb-2">
                    <QrCode className="h-16 w-16 text-brand-primary" />
                  </div>
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-brand-primary/30 flex items-center gap-3 transition-all active:scale-95"
                  >
                    <Camera className="h-5 w-5" />
                    <span>Tap to Scan</span>
                  </button>
                  <p className="text-sm text-slate-500 font-medium">Align QR code within the frame</p>
                </div>
                {/* Abstract Decorative Image */}
                <div 
                  className="absolute inset-0 opacity-10 pointer-events-none bg-center bg-no-repeat bg-cover" 
                  style={{ backgroundImage: "url('/images/checkin_scanner_bg.jpg')" }}
                ></div>
              </div>
            </div>

            <div className="mt-12 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                   <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Context Status</p>
                  <p className="font-bold text-brand-slate">Scanning Venue Node</p>
                </div>
              </div>
            </div>
          </>
        ) : step === 'welcome' && selected ? (
           <div className="w-full max-w-sm flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-12">
              <div className="text-center">
                 <div className="group relative mx-auto mb-8 inline-block">
                   <div className="absolute inset-0 bg-brand-primary blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                   <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white border border-brand-border shadow-2xl text-5xl font-black text-brand-primary">
                     {selected.name.charAt(0)}
                   </div>
                 </div>
                 <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tighter italic">Hi, {selected.name.split(' ')[0]}!</h2>
                 <div className="h-1 w-12 bg-brand-primary mx-auto mt-4 rounded-full"></div>
                 <p className="text-slate-500 mt-4 text-lg font-medium">Glad to see you again.</p>
              </div>
               
              <div className="flex flex-col gap-4 w-full">
                 <Button size="xl" onClick={handleConfirm} className="w-full py-10 text-xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/20 rounded-2xl">
                   I&apos;m Here
                 </Button>
                 <button 
                   onClick={handleStartLinking}
                   className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-brand-primary transition-colors py-4"
                 >
                   Not you? Change Profile
                 </button>
              </div>

              <div className="w-full p-5 rounded-2xl bg-white border border-brand-border/50 shadow-sm flex items-center gap-4">
                 <div className="size-12 rounded-xl bg-brand-primary/5 flex items-center justify-center text-brand-primary">
                    <MapPin className="h-6 w-6" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Venue</p>
                    <p className="font-bold text-slate-800">{unitName ?? 'Main Venue'}</p>
                 </div>
              </div>
           </div>
        ) : step === 'list' ? (
           <div className="w-full max-w-sm flex flex-col gap-8 animate-in fade-in duration-500">
              <div className="text-center">
                <h1 className="text-3xl font-bold mb-3 tracking-tight">Check In</h1>
                <p className="text-slate-600">Select your name from the roster.</p>
              </div>

              <div className="relative group">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Find your name…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-6 text-base font-medium transition-all focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5"
                  autoFocus
                />
              </div>

              {listLoading ? (
                <div className="flex justify-center py-12">
                   <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
                </div>
              ) : listError ? (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 shadow-sm border border-red-100 mb-6">
                  {listError}
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin">
                  {Object.entries(grouped).map(([section, sectionMembers]) => (
                    <div key={section} className="flex flex-col gap-2 mb-4">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{section || 'Others'}</p>
                       {sectionMembers.map(m => (
                         <button
                           key={m.id}
                           onClick={() => handleSelect(m)}
                           className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-brand-primary/40 hover:shadow-lg transition-all text-left"
                         >
                            <span className="font-bold text-slate-800">{m.name}</span>
                            <div className="size-8 rounded-lg bg-brand-primary/5 flex items-center justify-center">
                               <ArrowLeft className="h-4 w-4 text-brand-primary rotate-180" />
                            </div>
                         </button>
                       ))}
                    </div>
                  ))}
                </div>
              )}
           </div>
        ) : step === 'confirm' && selected ? (
          <div className="w-full max-w-sm flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-12">
             <div className="text-center">
                <div className="group relative mx-auto mb-8 inline-block">
                  <div className="absolute inset-0 bg-brand-primary blur-3xl opacity-10"></div>
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white border border-brand-border shadow-2xl text-5xl font-black text-brand-primary">
                    {selected.name.charAt(0)}
                  </div>
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-3">Identity Proof</h3>
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Is this you?</h2>
                <div className="mt-8 p-6 rounded-2xl bg-white border border-brand-primary/20 shadow-xl shadow-brand-primary/5 w-full">
                   <p className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">{selected.name}</p>
                   {selected.section && (
                     <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mt-2">{selected.section} Section</p>
                   )}
                </div>
             </div>

             <div className="flex flex-col gap-4 w-full">
               <Button size="xl" onClick={handleConfirm} className="w-full h-20 text-lg font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/30 rounded-2xl">
                 Confirmed
               </Button>
               <button onClick={handleBack} className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 hover:text-brand-primary py-4">
                 Abort & Return
               </button>
             </div>
          </div>
        ) : step === 'done' && (
           <div className="w-full max-w-sm pt-20 animate-in zoom-in-95 duration-500">
             {status === 'loading' ? (
                <div className="flex flex-col items-center gap-6 py-12 rounded-[3rem] bg-white border border-slate-100 shadow-xl">
                  <div className="h-14 w-14 animate-spin rounded-full border-[6px] border-brand-primary border-t-transparent" />
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">Syncing node...</p>
                </div>
             ) : status === 'success' ? (
                <div className="flex flex-col items-center gap-10 text-center py-16 px-6 rounded-[3.5rem] bg-white shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-10 duration-1000">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse"></div>
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-green-500 text-white shadow-2xl shadow-green-500/40">
                       <CheckCircle className="h-12 w-12" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic mb-3">Verified!</h2>
                    {checkedInName && (
                      <p className="text-lg text-slate-600 font-medium">
                        Welcome, <span className="font-black text-slate-900">{checkedInName}</span>
                      </p>
                    )}
                  </div>
                  <Button size="lg" onClick={() => navigate('/')} className="w-full py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-xl shadow-brand-primary/20">
                    Exit Terminal
                  </Button>
                </div>
             ) : (
                <div className="flex flex-col items-center gap-8 text-center py-16 rounded-[3.5rem] bg-red-50 border border-red-100">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500 text-white shadow-xl">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <div className="px-8">
                    <h2 className="text-xl font-black text-red-900 uppercase tracking-tight mb-2">Sync Refused</h2>
                    <p className="text-sm text-red-600 font-medium">{errorMessage ?? 'Protocol mismatch or error.'}</p>
                  </div>
                  <button onClick={handleBack} className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary">
                    Reload Protocol
                  </button>
                </div>
             )}
           </div>
        )}

        {/* Footer Admin Link */}
        <div className="mt-auto pt-8 text-center">
          <p className="text-slate-500 text-sm">
            Not a visitor? 
            <button 
              onClick={() => navigate('/admin')}
              className="text-brand-primary font-bold hover:underline ml-1"
            >
              Admin Portal
            </button>
          </p>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="flex border-t border-slate-200 bg-white/80 backdrop-blur-md px-4 pb-6 pt-3">
        <button onClick={() => navigate('/')} className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400">
          <Home className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
        </button>
        <button onClick={() => { setStep('list'); setSelected(null); }} className="flex flex-1 flex-col items-center justify-center gap-1 text-brand-primary">
          <Scan className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Check-in</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400">
          <Calendar className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Events</span>
        </button>
        <button className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400">
          <User className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
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
