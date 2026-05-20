import { useState, useRef, useEffect } from 'react'
import { Bell, X, User, Cake, Smartphone } from 'lucide-react'
import { useBirthdayNotifications } from '../hooks/useBirthdayNotifications'
import { useAdminPushNotifications } from '../hooks/useAdminPushNotifications'

export function NotificationBell({ unitId }: { unitId: string }) {
    const { notifications, count, dismissNotification } = useBirthdayNotifications(unitId)
    const adminPush = useAdminPushNotifications(unitId)
    const [isOpen, setIsOpen] = useState(false)
    const [pushMessage, setPushMessage] = useState<string | null>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function enablePhoneAlerts() {
        setPushMessage(null)
        const result = await adminPush.subscribe()
        if (result === 'granted') {
            setPushMessage('Phone alerts enabled')
        } else if (result === 'denied') {
            setPushMessage('Notifications were not allowed')
        } else {
            setPushMessage('Could not enable phone alerts')
        }
    }

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative size-10 flex items-center justify-center rounded-none bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                title="Birthday alerts"
                aria-label={`Birthday alerts${count > 0 ? `, ${count} unread` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <Bell className="h-5 w-5 text-white" />
                {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-none bg-amber-500 px-1 text-2xs font-bold leading-none text-white ring-2 ring-background-dark">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-x-4 top-20 z-50 flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-none border border-border-dark bg-surface-dark p-2 shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-150 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-h-none sm:origin-top-right"
                    role="dialog"
                    aria-label="Birthday alerts"
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border-dark mb-1">
                        <h3 className="text-2xs font-bold uppercase tracking-spaced text-slate-400">
                            Birthday Alerts
                        </h3>
                        {count === 0 && (
                            <span className="text-2xs text-slate-500">All clear</span>
                        )}
                    </div>

                    {adminPush.isSupported && (
                        <div className="mb-1 flex items-center justify-between gap-3 border-b border-border-dark px-3 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <Smartphone className={`h-4 w-4 flex-shrink-0 ${adminPush.isSubscribed ? 'text-teal' : 'text-slate-400'}`} />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-100">
                                        {adminPush.isSubscribed ? 'Phone alerts on' : 'Get phone pings'}
                                    </p>
                                    <p className="truncate text-2xs text-slate-500">
                                        {pushMessage ?? (adminPush.isSubscribed ? 'Birthday alerts can ping this device' : 'Enable birthday reminders on this device')}
                                    </p>
                                </div>
                            </div>
                            {!adminPush.isSubscribed && (
                                <button
                                    type="button"
                                    onClick={enablePhoneAlerts}
                                    disabled={adminPush.loading}
                                    className="flex-shrink-0 rounded-none border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-2xs font-black uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-50"
                                >
                                    {adminPush.loading ? 'Wait' : 'Enable'}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain flex flex-col gap-0.5 sm:max-h-80">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <Cake className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                                <p className="text-sm text-slate-400">No new alerts</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="group relative flex items-start gap-3 rounded-none p-2.5 hover:bg-white/5 transition-colors"
                                >
                                    <div className="size-8 flex items-center justify-center rounded-none bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className="text-sm font-semibold text-slate-100 truncate">
                                            {n.member_name}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {n.type === 'birthday_eve' ? 'Birthday in 1 week!' : 'Birthday today! 🎉'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => dismissNotification(n.id)}
                                        className="absolute right-1.5 top-1.5 p-1 text-slate-500 hover:text-slate-300 rounded-none hover:bg-white/5 transition-colors"
                                        title="Dismiss"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


