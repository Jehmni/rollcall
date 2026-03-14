import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, Clock, AlertCircle, Users, Search, Settings, LayoutDashboard, Calendar, Cake } from 'lucide-react'
import { TallyCount } from '../components/TallyCount'
import { useAttendance } from '../hooks/useAttendance'
import { useServiceMembers, useMemberById, useEventBranding, type PublicMember } from '../hooks/useChoristers'
import { Button } from '../components/ui/Button'
import { QRScanner } from '../components/QRScanner'

type Step = 'welcome' | 'list' | 'confirm' | 'done'

export default function CheckIn() {
  const [searchParams] = useSearchParams()
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
  const { orgName } = useEventBranding(serviceId)

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
    window.location.reload() // Reload to catch new event_id in hooks
  }

  const noService = !serviceId

  return (
    <div className="flex min-h-screen flex-col bg-brand-secondary">
      {/* High-Contrast Header */}
      <header className="bg-brand-primary px-6 pt-12 pb-8 rounded-b-[2rem] shadow-xl shadow-brand-primary/20 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Rollcally</h1>
            <p className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] mt-1">
              {orgName}
            </p>
          </div>
          <button className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 -mt-4 pb-24 relative z-20">

        {/* No service */}
        {noService && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm border border-brand-border">
            <AlertCircle className="h-12 w-12 text-brand-gold" />
            <div>
              <h2 className="font-semibold text-brand-text">No active event</h2>
              <p className="mt-1 text-sm text-gray-500">
                This QR code is not linked to an event. Ask your administrator for a fresh code.
              </p>
            </div>
          </div>
        )}

        {!noService && step === 'welcome' && selected && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-brand-primary/10 border border-brand-border flex flex-col items-center text-center">
              <div className="flex items-start justify-between w-full mb-8">
                <div className="text-left">
                  <h2 className="text-4xl font-black text-brand-text leading-[1.1] tracking-tight">
                    Welcome<br />Back,<br />{selected.name.split(' ')[0]}!
                  </h2>
                </div>
                <TallyCount count={5} className="mt-2" />
              </div>
              
              <Button 
                size="xl" 
                onClick={handleConfirm} 
                className="w-full py-8 text-xl font-black tracking-widest uppercase rounded-[2rem] shadow-2xl shadow-brand-primary/30 transition-transform active:scale-95 bg-brand-primary hover:bg-brand-primary/90"
              >
                I&apos;m Here
              </Button>

              {/* Birthday Prompt Mockup */}
              <div className="mt-8 bg-white border border-brand-border rounded-2xl p-4 flex items-center gap-3 shadow-sm w-full">
                <div className="p-2 bg-brand-gold/10 rounded-lg">
                  <Cake className="h-5 w-5 text-brand-gold" />
                </div>
                <p className="text-sm font-bold text-brand-text">Birthday tomorrow! Tap to share?</p>
              </div>

              <button 
                onClick={handleStartLinking}
                className="mt-8 text-xs font-bold uppercase tracking-widest text-brand-slate hover:text-brand-primary transition-colors"
              >
                Not {selected.name}? Tap here to change
              </button>
            </div>
          </div>
        )}

        {/* Member list */}
        {!noService && step === 'list' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            {/* Search and Filters */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                type="search"
                placeholder="Search your name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-xl border border-brand-border bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-brand-primary/50 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 placeholder:text-brand-slate/40"
                autoFocus
              />
              </div>

              {/* Section Filters */}
              {Object.keys(grouped).length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setActiveSection(null)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      !activeSection ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white text-brand-slate hover:bg-brand-secondary border border-brand-border'
                    }`}
                  >
                    All Sections
                  </button>
                  {Object.keys(grouped).map(s => s && (
                    <button
                      key={s}
                      onClick={() => setActiveSection(s)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activeSection === s ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white text-brand-slate hover:bg-brand-secondary border border-brand-border'
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
                  <div className="flex flex-col gap-1.5">
                    {sectionMembers.map(m => (
                       <button
                        key={m.id}
                        onClick={() => handleSelect(m)}
                        className="flex min-h-[3.5rem] items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm border border-brand-border hover:border-brand-primary/30 hover:shadow-md active:scale-[0.99] transition-all text-left"
                      >
                        <span className="text-base font-medium text-brand-text">{m.name}</span>
                        {m.section && !activeSection && (
                          <span className="ml-3 flex-shrink-0 rounded-full bg-brand-primary/5 px-2.5 py-1 text-xs font-semibold text-brand-primary">
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
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-brand-border">
              <p className="mb-4 text-sm text-brand-slate">Is this you?</p>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-primary/5 text-xl font-bold text-brand-primary border border-brand-primary/10">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-bold text-brand-text">{selected.name}</p>
                  {selected.section && (
                    <p className="mt-0.5 text-sm font-medium text-brand-primary">{selected.section}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="lg" onClick={handleConfirm} className="w-full">
                  Yes, check me in
                </Button>
                <Button variant="ghost" size="lg" onClick={handleBack} className="w-full">
                  No, go back
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Result states */}
         {!noService && step === 'done' && (
          <div className="mt-4 rounded-2xl bg-white p-8 shadow-sm border border-brand-border">

            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
                <p className="text-sm text-brand-slate">Recording attendance…</p>
              </div>
            )}

             {status === 'success' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <div>
                  <h2 className="text-xl font-bold text-brand-text">You&apos;re in!</h2>
                  {checkedInName && (
                    <p className="mt-1 text-base text-brand-slate">
                      Welcome, <span className="font-semibold text-brand-text">{checkedInName}</span>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-brand-slate/60">Attendance recorded. Enjoy the event.</p>
                </div>
              </div>
            )}

             {status === 'already_checked_in' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <Clock className="h-14 w-14 text-brand-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-brand-text">Already checked in</h2>
                  {checkedInName && (
                    <p className="mt-1 text-sm text-brand-slate">
                      <span className="font-medium text-brand-text">{checkedInName}</span>, your attendance is already recorded.
                    </p>
                  )}
                </div>
                <button onClick={handleBack} className="text-sm text-brand-primary hover:underline">
                  Go back
                </button>
              </div>
            )}

             {(status === 'not_found' || status === 'invalid_service' || status === 'error') && (
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="h-14 w-14 text-red-500" />
                <div>
                  <h2 className="text-lg font-semibold text-brand-text">Something went wrong</h2>
                  <p className="mt-1 text-sm text-red-600">{errorMessage ?? 'Please try again.'}</p>
                </div>
                <button onClick={handleBack} className="text-sm text-brand-primary hover:underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Styled Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-border px-6 py-4 flex items-center justify-between shadow-[0_-4px_20px_0_rgba(0,0,0,0.05)] z-30">
        <button className="flex flex-col items-center gap-1 group">
          <LayoutDashboard className="h-6 w-6 text-brand-slate group-hover:text-brand-primary transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-slate group-hover:text-brand-primary">Dashboard</span>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <div className="relative">
            <Users className="h-6 w-6 text-brand-primary" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-primary rounded-full"></div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Members</span>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <Calendar className="h-6 w-6 text-brand-slate group-hover:text-brand-primary transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-slate group-hover:text-brand-primary">Services</span>
        </button>
        <button className="flex flex-col items-center gap-1 group">
          <Settings className="h-6 w-6 text-brand-slate group-hover:text-brand-primary transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-slate group-hover:text-brand-primary">Settings</span>
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
