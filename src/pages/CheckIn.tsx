import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAttendance } from '../hooks/useAttendance'
import { useServiceMembers, useMemberById, useServiceInfo, type PublicMember } from '../hooks/useChoristers'
import { QRScanner } from '../components/QRScanner'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { supabase } from '../lib/supabase'

type Step = 'welcome' | 'list' | 'confirm' | 'done'

export default function CheckIn() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('list')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PublicMember | null>(null)
  const [successTime, setSuccessTime] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const storedMemberId = localStorage.getItem('rollcally_member_id')
  const { member: recognizedMember } = useMemberById(storedMemberId)

  const paramServiceId = searchParams.get('service_id')
  const serviceId = paramServiceId ?? sessionStorage.getItem('pending_service_id')
  const { unitName, unitId, requireLocation, smsEnabled } = useServiceInfo(serviceId)

  // All check-in state lives in the hook
  const { status, checkedInName, errorMessage, checkIn, reset } = useAttendance(serviceId, requireLocation)

  // Push notification opt-in
  const { isSupported: pushSupported, currentPermission, subscribe } = usePushNotifications()
  const [pushOptIn, setPushOptIn] = useState<'idle' | 'asking' | 'done'>('idle')
  const [smsConsent, setSmsConsent] = useState<'idle' | 'asking' | 'done'>('idle')

  useEffect(() => {
    if (status === 'success' && pushSupported && currentPermission === 'default') {
      setPushOptIn('asking')
    }
  }, [status, pushSupported, currentPermission])

  // Show SMS consent prompt once push is resolved (or if push isn't applicable).
  // Only shown if: unit has SMS messaging enabled + this member hasn't been asked before.
  useEffect(() => {
    if (status !== 'success') return
    if (smsConsent !== 'idle') return
    // Wait for push prompt to resolve before showing SMS prompt
    const pushResolved = pushOptIn === 'done' || !pushSupported || currentPermission !== 'default'
    if (!pushResolved) return
    if (!smsEnabled) return
    const memberId = selected?.id ?? localStorage.getItem('rollcally_member_id')
    if (!memberId || !unitId) return
    // Use localStorage so we only ask once per member per unit
    const key = `rollcally_sms_asked_${memberId}_${unitId}`
    if (!localStorage.getItem(key)) {
      setSmsConsent('asking')
    } else {
      setSmsConsent('done')
    }
  }, [status, pushOptIn, pushSupported, currentPermission, smsEnabled, smsConsent, selected, unitId])

  async function handlePushEnable() {
    const memberId = selected?.id ?? localStorage.getItem('rollcally_member_id')
    if (!memberId || !unitId) { setPushOptIn('done'); return }
    await subscribe(memberId, unitId)
    setPushOptIn('done')
  }

  async function handleSmsConsent(consent: boolean) {
    const memberId = selected?.id ?? localStorage.getItem('rollcally_member_id')
    if (memberId && unitId) {
      // Mark as asked in localStorage so we don't prompt again on this device
      localStorage.setItem(`rollcally_sms_asked_${memberId}_${unitId}`, '1')
      // Persist consent to DB via SECURITY DEFINER RPC (works without an auth session)
      await supabase.rpc('set_member_sms_consent', { p_member_id: memberId, p_consent: consent })
    }
    setSmsConsent('done')
  }

  useEffect(() => {
    if (paramServiceId) sessionStorage.setItem('pending_service_id', paramServiceId)
  }, [paramServiceId])

  useEffect(() => {
    if (recognizedMember && step === 'list') {
      setStep('welcome')
      setSelected(recognizedMember)
    }
  }, [recognizedMember, step])

  const { members, loading: listLoading, error: listError } = useServiceMembers(serviceId, query)

  const grouped = useMemo(() => {
    const sections = [...new Set(members.map(m => m.section ?? ''))].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    return sections.reduce<Record<string, PublicMember[]>>((acc, s) => {
      acc[s] = members.filter(m => (m.section ?? '') === s)
      return acc
    }, {})
  }, [members])

  function handleSelect(m: PublicMember) {
    setSelected(m)
    setStep('confirm')
  }

  function handleStartLinking() {
    setStep('list')
    setSelected(null)
    reset()
  }

  async function handleConfirm() {
    if (!selected || !serviceId) return
    setStep('done')
    try {
      await checkIn(selected.id)
      setSuccessTime(
        new Date().toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).replace(',', ' •')
      )
    } catch {
      // hook already set status and errorMessage
    }
  }

  function handleBack() {
    setStep('list')
    setSelected(null)
    reset()
  }

  function handleScan(scannedServiceId: string) {
    sessionStorage.setItem('pending_service_id', scannedServiceId)
    setSearchParams({ service_id: scannedServiceId })
    setShowScanner(false)
  }

  function getErrorDisplay(): string {
    if (status === 'already_checked_in')
      return `Already checked in${checkedInName ? ` — ${checkedInName}` : ''}`
    if (status === 'not_found') return "Member not found in this event's roster"
    if (status === 'invalid_service' || status === 'no_service') return 'Invalid or expired event link'
    return errorMessage ?? 'Something went wrong'
  }

  const noService = !serviceId

  const headerTitle = useMemo(() => {
    if (step === 'done') {
      if (status === 'success') return 'Verification'
      if (status === 'loading') return 'Processing'
      return 'Sync Denied'
    }
    return 'Check In'
  }, [step, status])

  return (
    <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased">
      {/* Top Navigation Header */}
      <header className="grid grid-cols-3 items-center p-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 'confirm' ? handleBack() : navigate('/')}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-white">{step === 'done' ? 'close' : 'arrow_back'}</span>
          </button>
          {step !== 'done' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-300">
              <img src="/logo.png" alt="Rollcally" className="h-7 w-7 object-contain" />
              <span className="font-extrabold text-sm tracking-tight text-white hidden sm:block">Rollcally</span>
            </div>
          )}
        </div>

        <div className="text-center">
          <span className="font-black text-white uppercase tracking-tighter text-sm">
            {headerTitle}
          </span>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => navigate('/help')}
            className="flex size-10 items-center justify-center rounded-full hover:bg-primary/20 transition-colors text-slate-400 hover:text-white"
            title="User Guide"
          >
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-28 sm:pb-12 overflow-y-auto">
        {noService ? (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="text-center mb-10 max-w-sm">
              <p className="text-slate-400 text-base leading-relaxed">
                Scan the QR code at your venue to register attendance.
              </p>
            </div>

            <div className="w-full max-w-sm aspect-square relative group">
              <div className="absolute -top-1 -left-1 size-8 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              <div className="absolute -top-1 -right-1 size-8 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              <div className="absolute -bottom-1 -left-1 size-8 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>
              <div className="absolute -bottom-1 -right-1 size-8 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[0_0_15px_rgba(82,71,230,0.5)]"></div>

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
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none bg-center bg-no-repeat bg-cover saturate-[1.5]"
                  style={{ backgroundImage: "url('/images/checkin_scanner_bg.jpg')" }}
                ></div>
              </div>
            </div>

            <div className="mt-12 w-full max-w-sm">
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10 shadow-lg">
                <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                  <span className="material-symbols-outlined text-2xl">location_on</span>
                </div>
                <div>
                  <p className="text-2xs text-slate-500 uppercase tracking-spaced font-black">Venue Status</p>
                  <p className="font-extrabold text-white text-lg tracking-tight uppercase">
                    {unitName || 'Will update after you scan qrcode'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : step === 'welcome' && selected ? (
          <div className="w-full max-w-sm flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-8">
            <div className="text-center">
              <div className="group relative mx-auto mb-10 inline-block">
                <div className="absolute inset-0 bg-primary blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative flex h-36 w-36 items-center justify-center rounded-[3rem] bg-background-dark border border-primary/30 shadow-2xl text-6xl font-black text-primary">
                  {selected.name.charAt(0)}
                </div>
              </div>
              <h2 className="font-display text-4xl font-bold text-white leading-tight uppercase tracking-tighter">
                Hi, {selected.name.split(' ')[0]}!
              </h2>
              <div className="h-1.5 w-16 bg-primary mx-auto mt-4 rounded-full shadow-[0_0_10px_rgba(82,71,230,0.5)]"></div>
              <p className="text-slate-400 mt-6 text-xl font-medium">Glad to see you again.</p>
            </div>

            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={handleConfirm}
                className="w-full py-8 text-xl font-black uppercase tracking-spaced bg-primary text-white rounded-3xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                I&apos;m Here
              </button>
              <button
                onClick={handleStartLinking}
                className="text-2xs font-black uppercase tracking-spread text-slate-500 hover:text-primary transition-colors py-4"
              >
                Not you? Switch Profile
              </button>
            </div>

            <div className="w-full p-6 rounded-3xl bg-primary/5 border border-primary/10 shadow-xl flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                <span className="material-symbols-outlined text-3xl">location_on</span>
              </div>
              <div>
                <p className="text-2xs font-black uppercase tracking-spaced text-slate-500">Venue Verified</p>
                <p className="font-extrabold text-white text-lg uppercase tracking-tight">{unitName ?? 'Main Venue Node'}</p>
              </div>
            </div>
          </div>
        ) : step === 'list' ? (
          <div className="w-full max-w-sm flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="text-center">
              <h1 className="font-display text-4xl font-bold mb-3 tracking-tighter uppercase">Check In</h1>
              <p className="text-slate-400">Locate your credentials in the roster.</p>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">search</span>
              <input
                type="search"
                placeholder="Search your name…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full rounded-2xl border border-primary/10 bg-primary/5 py-5 pl-12 pr-6 text-lg font-bold transition-all focus:border-primary/50 focus:ring-8 focus:ring-primary/5 placeholder:text-slate-500 text-white shadow-xl"
                autoFocus
              />
            </div>

            {query.length < 3 ? (
              <div className="flex flex-col items-center gap-6 py-12 px-8 rounded-3xl bg-primary/5 border border-dashed border-primary/20 text-center animate-in fade-in duration-700">
                <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary/40 mb-2">
                  <span className="material-symbols-outlined text-4xl">person_search</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-white font-bold text-lg uppercase tracking-tight">Identity Search</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Enter at least 3 characters of your name to locate your profile and verify attendance.
                  </p>
                </div>
              </div>
            ) : listLoading ? (
              <div className="flex flex-col gap-3 w-full">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="size-10 rounded-full flex-shrink-0 animate-pulse bg-white/[0.08]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-28 animate-pulse rounded-lg bg-white/[0.08]" />
                      <div className="h-2.5 w-16 animate-pulse rounded-lg bg-white/[0.08]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-h-[45vh] overflow-y-auto pr-2 scrollbar-hide">
                {listError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold text-center">
                    {listError}
                  </div>
                )}
                {members.length === 0 && query && (
                  <div className="flex flex-col items-center gap-3 py-10 px-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <span className="material-symbols-outlined text-4xl text-slate-500">search_off</span>
                    <p className="text-sm font-semibold text-slate-400 text-center">No members match <span className="text-white">"{query}"</span></p>
                    <p className="text-2xs text-slate-500 text-center">Check the spelling or try a different name.</p>
                    <div className="mt-6 pt-2 w-full text-center">
                      <p className="text-xs text-slate-500 font-medium">Not in the system?</p>
                      <p className="text-2xs text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">Please locate the nearest official to be added to the unit roster.</p>
                    </div>
                  </div>
                )}
                {Object.entries(grouped).map(([section, sectionMembers]) => (
                  <div key={section} className="flex flex-col gap-3 mb-4">
                    <h3 className="text-2xs font-black uppercase tracking-spread text-primary/60 ml-2">
                      {section || 'Main Roster'}
                    </h3>
                    {sectionMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => handleSelect(m)}
                        className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-primary/5 border border-primary/10 hover:border-primary/40 hover:bg-primary/10 hover:shadow-2xl active:scale-[0.98] active:bg-primary/15 transition-all duration-150 text-left group"
                      >
                        <span className="font-extrabold text-white text-lg tracking-tight uppercase">{m.name}</span>
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
                <div className="relative flex h-36 w-36 items-center justify-center rounded-[3rem] bg-background-dark border border-primary/30 shadow-2xl text-6xl font-black text-primary">
                  {selected.name.charAt(0)}
                </div>
              </div>
              <h3 className="text-2xs font-black uppercase tracking-super text-slate-500 mb-4">Biometric Verification</h3>
              <h2 className="font-display text-4xl font-bold text-white uppercase tracking-tighter">Is this you?</h2>
              <div className="mt-10 p-8 rounded-[2.5rem] bg-primary/5 border border-primary/20 shadow-[0_0_50px_rgba(82,71,230,0.1)] w-full relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 h-24 w-24 bg-primary/10 rounded-full blur-2xl"></div>
                <p className="text-3xl font-black text-white uppercase tracking-tighter relative z-10">{selected.name}</p>
                {selected.section && (
                  <p className="text-2xs font-black uppercase tracking-spread text-primary mt-3 relative z-10">
                    {selected.section} Control Node
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={handleConfirm}
                className="w-full h-24 text-xl font-black uppercase tracking-spaced bg-primary text-white rounded-3xl shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Yes, check me in
              </button>
              <button
                onClick={handleBack}
                className="text-2xs font-black uppercase tracking-spread text-slate-500 hover:text-primary py-4"
              >
                No, go back
              </button>
            </div>
          </div>
        ) : step === 'done' ? (
          <div className="w-full max-w-sm pt-4 animate-in zoom-in-95 duration-500">
            {status === 'loading' ? (
              <div className="flex flex-col items-center gap-8 py-20 rounded-[4rem] bg-primary/5 border border-primary/20 shadow-2xl">
                <div className="relative size-20">
                  <div className="absolute inset-0 rounded-full border-[6px] border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-[6px] border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-3 flex items-center justify-center">
                    <img src="/logo.png" alt="" className="w-full h-full object-contain opacity-70" />
                  </div>
                </div>
                <p className="text-xs font-black uppercase tracking-super text-primary animate-pulse">Securing Protocols...</p>
              </div>
            ) : status === 'success' ? (
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
                <div className="relative flex flex-col items-center justify-center mb-8">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150"></div>
                  <div className="relative bg-primary text-white rounded-[2.5rem] p-6 shadow-[0_0_60px_rgba(82,71,230,0.5)] border border-white/20">
                    <span className="material-symbols-outlined !text-7xl">check_circle</span>
                  </div>
                </div>

                <div className="text-center space-y-3 mb-12">
                  <h1 className="font-display text-white text-5xl font-bold tracking-tighter uppercase">You're in!</h1>
                  <p className="text-slate-400 text-lg font-medium tracking-tight">Check-in Successful</p>
                </div>

                <div className="w-full bg-primary/5 border border-primary/20 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm relative">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 size-32 bg-primary/10 rounded-full blur-3xl"></div>

                  <div className="p-8 text-center pb-0">
                    <div className="inline-block size-24 rounded-full border-2 border-primary p-2 mb-6 group relative">
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative w-full h-full rounded-full bg-background-dark border border-primary/30 flex items-center justify-center text-3xl font-black text-primary">
                        {selected?.name.charAt(0)}
                      </div>
                    </div>
                    <h2 className="font-display text-white text-3xl font-bold uppercase tracking-tighter mb-1">
                      Welcome, {selected?.name}
                    </h2>
                    <p className="text-primary font-black uppercase tracking-spaced text-2xs">Confirmed Attendee</p>
                  </div>

                  <div className="p-8 space-y-6">
                    <div className="flex items-center gap-5">
                      <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/10">
                        <span className="material-symbols-outlined text-2xl">corporate_fare</span>
                      </div>
                      <div>
                        <p className="text-slate-500 text-2xs uppercase tracking-spread font-black mb-1">Venue</p>
                        <p className="text-white font-black uppercase text-lg tracking-tight">
                          {unitName || 'Main Conference Hall'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/10">
                        <span className="material-symbols-outlined text-2xl">schedule</span>
                      </div>
                      <div>
                        <p className="text-slate-500 text-2xs uppercase tracking-spread font-black mb-1">Time</p>
                        <p className="text-white font-bold text-lg tracking-tight">{successTime || 'Registering...'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Push opt-in card */}
                {pushOptIn === 'asking' && (
                  <div className="w-full mt-6 rounded-2xl bg-primary/10 border border-primary/30 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined text-primary text-3xl flex-shrink-0">notifications</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white mb-1">Get instant check-in next time</p>
                        <p className="text-2xs text-slate-400 leading-relaxed">Enable notifications so your admin can alert you when a session starts — one tap and you're checked in.</p>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={handlePushEnable}
                            className="flex-1 bg-primary text-white text-2xs font-black uppercase tracking-spaced py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all"
                          >
                            Enable
                          </button>
                          <button
                            onClick={() => setPushOptIn('done')}
                            className="flex-1 text-slate-400 text-2xs font-black uppercase tracking-spaced py-2.5 rounded-xl border border-border-dark hover:text-white hover:border-slate-500 active:scale-95 transition-all"
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SMS consent card — shown after push prompt resolves, only if unit uses SMS */}
                {smsConsent === 'asking' && (
                  <div className="w-full mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined text-amber-400 text-3xl flex-shrink-0">sms</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white mb-1">Stay in the loop</p>
                        <p className="text-2xs text-slate-400 leading-relaxed">
                          {unitName
                            ? <><span className="text-slate-300 font-semibold">{unitName}</span> may send you a text message if you miss a session.</>
                            : 'Your unit may send you a text message if you miss a session.'
                          }
                          {' '}You can change this at any time.
                        </p>
                        <p className="text-2xs text-slate-600 mt-1.5">
                          By tapping "Yes" you consent to receiving SMS from {unitName ?? 'your unit'}.
                          Standard message rates may apply.
                        </p>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleSmsConsent(true)}
                            className="flex-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-2xs font-black uppercase tracking-spaced py-2.5 rounded-xl hover:bg-amber-500/30 active:scale-95 transition-all"
                          >
                            Yes, that's fine
                          </button>
                          <button
                            onClick={() => handleSmsConsent(false)}
                            className="flex-1 text-slate-400 text-2xs font-black uppercase tracking-spaced py-2.5 rounded-xl border border-border-dark hover:text-white hover:border-slate-500 active:scale-95 transition-all"
                          >
                            No thanks
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="w-full mt-10">
                  <button
                    onClick={() => navigate('/')}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-black py-6 rounded-3xl shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 uppercase tracking-spread text-xs"
                  >
                    <span>Done</span>
                    <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                  <p className="text-center text-slate-500 text-2xs font-black uppercase tracking-spaced mt-6">
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
                  <h2 className="font-display text-3xl font-bold text-white uppercase tracking-tighter mb-3">Sync Denied</h2>
                  <p className="text-base text-red-500 font-bold uppercase tracking-wide leading-relaxed">
                    {getErrorDisplay()}
                  </p>
                </div>
                <button
                  onClick={handleBack}
                  className="text-xs font-black uppercase tracking-super text-primary hover:underline underline-offset-8"
                >
                  Re-verify Identity
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-auto pt-10 text-center pb-20">
          <p className="text-slate-500 text-2xs font-black tracking-spaced uppercase">
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

      {/* Bottom Navigation Bar — mobile focused */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex bg-background-dark/90 backdrop-blur-xl px-4 pt-4 sm:hidden"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-primary transition-all group"
        >
          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">home</span>
          <span className="text-2xs font-black uppercase tracking-widest">Home</span>
        </button>
        <button
          onClick={() => { setStep('list'); setSelected(null); }}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-primary relative"
        >
          <div className="absolute -top-1 w-12 h-1 bg-primary rounded-full blur-sm"></div>
          <span className="material-symbols-outlined text-2xl scale-125" style={{ fontVariationSettings: "'FILL' 1" }}>person_check</span>
          <span className="text-2xs font-black uppercase tracking-widest">Check-in</span>
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
