import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, AlertCircle, Search, ArrowLeft, ShieldCheck, QrCode } from 'lucide-react'
import { useAttendance } from '../hooks/useAttendance'
import { useServiceMembers, useMemberById, type PublicMember } from '../hooks/useChoristers'
import { Button } from '../components/ui/Button'
import { QRScanner } from '../components/QRScanner'

type Step = 'welcome' | 'list' | 'confirm' | 'done'

export default function CheckIn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('list')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PublicMember | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const storedMemberId = localStorage.getItem('rollcally_member_id')
  const { member: recognizedMember } = useMemberById(storedMemberId)

  const paramServiceId = searchParams.get('event_id')
  const serviceId = paramServiceId ?? sessionStorage.getItem('pending_event_id')

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
    <div className="flex min-h-screen flex-col bg-brand-secondary">
      {/* Header */}
      <header className="flex flex-col gap-8 px-5 sm:px-8 pt-12 sm:pt-24 pb-12 sm:pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full max-w-7xl mx-auto">
          {(step === 'confirm' || step === 'list' || step === 'welcome') && (
            <button
              onClick={step === 'confirm' ? handleBack : () => navigate('/')}
              className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
          <div className="flex flex-col items-center flex-1">
             <h1 className="text-2xl sm:text-3xl font-black tracking-tighter italic">Rollcally</h1>
             <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">Smart Entry</p>
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-all active:scale-95"
            title="Scan QR Code"
          >
            <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </button>
        </div>

        <div className="text-center relative z-10 mt-4 animate-in fade-in slide-in-from-top-4 duration-700 max-w-7xl mx-auto w-full px-4">
           <h2 className="text-xl sm:text-2xl font-black leading-tight">
             {step === 'welcome' ? 'Welcome Back' : step === 'list' ? 'Check In' : step === 'confirm' ? 'Is this you?' : 'Success!'}
           </h2>
            <p className="mt-2 text-xs sm:text-sm font-medium text-white/60">
              {step === 'welcome' ? 'Ready for today\'s session?' : step === 'list' ? 'Scan QR code to checkin' : step === 'confirm' ? 'Please verify your identity' : 'Attendance recorded'}
            </p>
        </div>
      </header>

      <div className="flex-1 px-5 sm:px-8 pb-8">

        {/* No service - Primary Scan Action */}
        {noService && (
          <div className="mt-8 sm:mt-12 flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 text-center max-w-5xl mx-auto w-full">
             <button
               onClick={() => setShowScanner(true)}
               className="group relative flex h-48 sm:h-64 w-full max-w-sm flex-col items-center justify-center gap-4 sm:gap-6 rounded-[2.5rem] sm:rounded-[3.5rem] bg-white border border-brand-border shadow-2xl hover:shadow-brand-primary/10 transition-all hover:-translate-y-1 active:scale-95"
             >
               <div className="absolute inset-0 bg-brand-primary/5 rounded-[2.5rem] sm:rounded-[3.5rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="relative flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-[1.5rem] sm:rounded-[2rem] bg-brand-primary/5 text-brand-primary border border-brand-primary/10 group-hover:bg-brand-primary group-hover:text-white transition-all duration-500 shadow-xl">
                  <QrCode className="h-10 w-10 sm:h-16 sm:w-16" />
               </div>
               <div className="flex flex-col items-center gap-1 px-4">
                 <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-brand-primary">Tap to Scan</span>
                 <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate opacity-40">Ready for checkin</span>
               </div>
             </button>
          </div>
        )}

        {/* Welcome Back Flow */}
        {!noService && step === 'welcome' && selected && (
          <div className="mt-12 flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
             <div className="text-center">
                <div className="group relative mx-auto mb-8 inline-block">
                  <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white border border-brand-border shadow-2xl text-5xl font-black text-brand-primary">
                    {selected.name.charAt(0)}
                  </div>
                </div>
                <h2 className="text-4xl font-black text-brand-text leading-tight uppercase tracking-tighter">Hi, {selected.name.split(' ')[0]}!</h2>
                <p className="text-brand-slate mt-3 text-lg font-medium opacity-60">Glad to see you again.</p>
             </div>
              
             <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
                <Button size="xl" onClick={handleConfirm} className="w-full py-10 text-xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/30 rounded-[2rem]">
                  I&apos;m Here
                </Button>
                <button 
                  onClick={handleStartLinking}
                  className="text-xs font-bold uppercase tracking-[0.2em] text-brand-slate hover:text-brand-primary transition-colors py-4 opacity-40 hover:opacity-100"
                >
                  Not you? Change Profile
                </button>
             </div>
          </div>
        )}

        {/* Member list */}
        {!noService && step === 'list' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Search and Filters */}
            <div className="flex flex-col gap-5 pt-8">
              <div className="relative group mx-1">
                <div className="absolute inset-0 bg-brand-primary/5 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-slate opacity-30 group-focus-within:opacity-100 transition-opacity" />
                <input
                  type="search"
                  placeholder="Find your name…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-brand-border/50 bg-white py-5 pl-14 pr-6 text-lg font-medium shadow-sm transition-all focus:border-brand-primary/50 focus:outline-none focus:ring-8 focus:ring-brand-primary/5 placeholder:text-brand-slate/30"
                  autoFocus
                />
              </div>

              {/* Section Filters */}
              {Object.keys(grouped).length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-1">
                  <button
                    onClick={() => setActiveSection(null)}
                    className={`whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                      !activeSection ? 'bg-brand-primary text-white border-brand-primary shadow-xl shadow-brand-primary/20 scale-105' : 'bg-white text-brand-slate hover:bg-brand-secondary border-brand-border opacity-60'
                    }`}
                  >
                    All Sections
                  </button>
                  {Object.keys(grouped).map(s => s && (
                    <button
                      key={s}
                      onClick={() => setActiveSection(s)}
                      className={`whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                        activeSection === s ? 'bg-brand-primary text-white border-brand-primary shadow-xl shadow-brand-primary/20 scale-105' : 'bg-white text-brand-slate hover:bg-brand-secondary border-brand-border opacity-60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {listLoading && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
              </div>
            )}

            {listError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{listError}</div>
            )}

            {!listLoading && filtered.length === 0 && !listError && (
              <p className="py-8 text-center text-sm text-gray-400">No members match your search.</p>
            )}

            {!listLoading && Object.entries(grouped)
              .filter(([section]) => !activeSection || section === activeSection)
              .map(([section, sectionMembers]) => (
                <div key={section} className="animate-in fade-in slide-in-from-left-2 duration-300">
                  {section && !activeSection && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 px-1">{section}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {sectionMembers.map(m => (
                       <button
                        key={m.id}
                        onClick={() => handleSelect(m)}
                         className="group flex min-h-[4rem] sm:min-h-[4.5rem] items-center justify-between rounded-2xl sm:rounded-3xl bg-white px-5 sm:px-8 py-5 sm:py-6 shadow-sm border border-brand-border/50 hover:border-brand-primary/40 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] transition-all text-left"
                      >
                        <span className="text-base sm:text-lg font-bold text-brand-text tracking-tight uppercase italic truncate mr-2">{m.name}</span>
                        {m.section && !activeSection && (
                          <span className="flex-shrink-0 rounded-xl bg-brand-primary/5 px-2 sm:px-3 py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary border border-brand-primary/10">
                            {m.section}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Confirmation */}
         {!noService && step === 'confirm' && selected && status === 'idle' && (
          <div className="mt-12 flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center">
               <div className="group relative mx-auto mb-8 inline-block">
                  <div className="absolute inset-0 bg-brand-primary blur-2xl opacity-10"></div>
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white border border-brand-border shadow-2xl text-5xl font-black text-brand-primary">
                    {selected.name.charAt(0)}
                  </div>
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-slate opacity-40 mb-3">Identity Verification</h3>
                <h2 className="text-3xl font-black text-brand-text uppercase tracking-tighter italic">Is this you?</h2>
                <div className="mt-6 inline-block bg-brand-primary/5 px-6 py-3 rounded-2xl border border-brand-primary/10">
                   <p className="text-xl font-bold text-brand-primary uppercase italic">{selected.name}</p>
                   {selected.section && (
                     <p className="text-[10px] font-black uppercase tracking-widest text-brand-slate opacity-40 mt-1">{selected.section} Node</p>
                   )}
                </div>
            </div>

            <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
              <Button size="xl" onClick={handleConfirm} className="w-full h-20 text-lg font-black uppercase tracking-[0.2em] shadow-2xl shadow-brand-primary/30 rounded-2xl">
                Confirmed
              </Button>
              <button 
                onClick={handleBack}
                className="text-xs font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 hover:opacity-100 hover:text-brand-primary transition-all py-4"
              >
                Abort & Return
              </button>
            </div>
          </div>
        )}

        {/* Result states */}
         {!noService && step === 'done' && (
          <div className="mt-12 animate-in zoom-in-95 fade-in duration-500">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-6 py-12 rounded-[3rem] bg-white shadow-sm border border-brand-border">
                <div className="h-14 w-14 animate-spin rounded-full border-[6px] border-brand-primary border-t-transparent" />
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-brand-slate opacity-40">Recording...</p>
              </div>
            )}

             {status === 'success' && (
              <div className="flex flex-col items-center gap-10 text-center py-16 rounded-[4rem] bg-white shadow-2xl shadow-brand-primary/10 border border-brand-border animate-in slide-in-from-bottom-10 duration-1000">
                <div className="relative">
                   <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse"></div>
                   <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-green-500 shadow-2xl shadow-green-500/40">
                      <CheckCircle className="h-12 w-12 text-white" />
                   </div>
                </div>
                <div>
                  <h2 className="text-4xl font-black text-brand-text uppercase tracking-tighter italic">Success!</h2>
                  {checkedInName && (
                    <p className="mt-4 text-xl text-brand-slate font-medium">
                      Welcome, <span className="font-black text-brand-text">{checkedInName}</span>
                    </p>
                  )}
                  <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-brand-primary opacity-60">Session Recorded</p>
                </div>
                <div className="pt-8 w-full border-t border-brand-border/50 max-w-[200px]">
                   <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 hover:opacity-100">
                     Finish
                   </Button>
                </div>
              </div>
            )}

             {status === 'already_checked_in' && (
              <div className="flex flex-col items-center gap-10 text-center py-16 rounded-[4rem] bg-white shadow-sm border border-brand-border">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-brand-primary/5 text-brand-primary border border-brand-primary/10">
                  <Clock className="h-10 w-10 opacity-40" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-brand-text uppercase tracking-tighter">Already In</h2>
                  <p className="mt-3 text-brand-slate font-medium opacity-60 max-w-xs mx-auto">
                    You have already recorded your attendance for this session.
                  </p>
                </div>
                <button onClick={handleBack} className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary hover:underline underline-offset-8">
                  Go Back
                </button>
              </div>
            )}

             {(status === 'not_found' || status === 'invalid_service' || status === 'error') && (
              <div className="flex flex-col items-center gap-8 text-center py-16 rounded-[3rem] bg-red-50/50 border border-red-100">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500 shadow-xl shadow-red-500/40">
                  <AlertCircle className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-red-900 uppercase tracking-tight">Something Went Wrong</h2>
                  <p className="mt-2 text-sm text-red-600 font-medium px-6">{errorMessage ?? 'Please try again or see an admin.'}</p>
                </div>
                <button onClick={handleBack} className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary">
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Link Footer */}
       <footer className="mt-auto px-4 py-6 text-center">
        <button
          onClick={() => window.location.href = '/admin'}
          className="inline-flex items-center gap-2 text-xs font-medium text-brand-slate hover:text-brand-primary transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin Portal
        </button>
      </footer>

      {showScanner && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  )
}
