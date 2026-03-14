import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, AlertCircle, Users, Search, ArrowLeft, ShieldCheck, QrCode } from 'lucide-react'
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
    window.location.reload() // Reload to catch new event_id in hooks
  }

  const noService = !serviceId

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-10 pb-4">
        {(step === 'confirm' || step === 'list' || step === 'welcome') && (
          <button
            onClick={step === 'confirm' ? handleBack : () => navigate('/')}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl hover:bg-blue-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-blue-700" />
          </button>
        )}
        <div className="flex flex-1 items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 shadow">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Rollcally</h1>
            <p className="text-xs text-gray-400">
              {step === 'welcome' ? 'Welcome back!' : step === 'list' ? 'Scan QR code to check in' : step === 'confirm' ? 'Confirm your identity' : ''}
            </p>
          </div>
        </div>
        
        <button
          onClick={() => setShowScanner(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-100 hover:bg-blue-50 hover:ring-blue-100 transition-colors"
          title="Scan QR Code"
        >
          <QrCode className="h-5 w-5 text-blue-700" />
        </button>
      </header>

      <div className="flex-1 px-4 pb-8">

        {/* No service */}
        {noService && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <AlertCircle className="h-12 w-12 text-amber-500" />
            <div>
              <h2 className="font-semibold text-gray-900">No active event</h2>
              <p className="mt-1 text-sm text-gray-500">
                This QR code is not linked to an event. Ask your administrator for a fresh code.
              </p>
            </div>
          </div>
        )}

        {/* Welcome Back Flow */}
        {!noService && step === 'welcome' && selected && (
          <div className="mt-8 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-3xl font-bold text-blue-700 shadow-inner">
                  {selected.name.charAt(0)}
                </div>
                <h2 className="mt-4 text-2xl font-bold text-gray-900">Welcome back, {selected.name.split(' ')[0]}!</h2>
                <p className="text-gray-500 mt-1">Ready for today&apos;s event?</p>
             </div>
             
             <div className="flex flex-col gap-3">
                <Button size="xl" onClick={handleConfirm} className="w-full py-8 text-lg shadow-xl shadow-blue-200">
                  <CheckCircle className="mr-2 h-6 w-6" /> I&apos;m Here
                </Button>
                <button 
                  onClick={handleStartLinking}
                  className="text-sm text-gray-400 hover:text-blue-600 transition-colors py-2"
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
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300"
                  autoFocus
                />
              </div>

              {/* Section Filters */}
              {Object.keys(grouped).length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setActiveSection(null)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      !activeSection ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 ring-1 ring-gray-100'
                    }`}
                  >
                    All Sections
                  </button>
                  {Object.keys(grouped).map(s => s && (
                    <button
                      key={s}
                      onClick={() => setActiveSection(s)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activeSection === s ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 ring-1 ring-gray-100'
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
                        className="flex min-h-[3.5rem] items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100 hover:ring-blue-300 hover:shadow-md active:scale-[0.98] transition-all text-left"
                      >
                        <span className="text-base font-medium text-gray-900">{m.name}</span>
                        {m.section && !activeSection && (
                          <span className="ml-3 flex-shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
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
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <p className="mb-4 text-sm text-gray-500">Is this you?</p>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700">
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{selected.name}</p>
                  {selected.section && (
                    <p className="mt-0.5 text-sm font-medium text-blue-600">{selected.section}</p>
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
          <div className="mt-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">

            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
                <p className="text-sm text-gray-500">Recording attendance…</p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">You&apos;re in!</h2>
                  {checkedInName && (
                    <p className="mt-1 text-base text-gray-600">
                      Welcome, <span className="font-semibold text-gray-900">{checkedInName}</span>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-gray-400">Attendance recorded. Enjoy the event.</p>
                </div>
              </div>
            )}

            {status === 'already_checked_in' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <Clock className="h-14 w-14 text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Already checked in</h2>
                  {checkedInName && (
                    <p className="mt-1 text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{checkedInName}</span>, your attendance is already recorded.
                    </p>
                  )}
                </div>
                <button onClick={handleBack} className="text-sm text-blue-600 hover:underline">
                  Go back
                </button>
              </div>
            )}

            {(status === 'not_found' || status === 'invalid_service' || status === 'error') && (
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="h-14 w-14 text-red-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
                  <p className="mt-1 text-sm text-red-600">{errorMessage ?? 'Please try again.'}</p>
                </div>
                <button onClick={handleBack} className="text-sm text-blue-600 hover:underline">
                  Try again
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
          className="inline-flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors"
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
