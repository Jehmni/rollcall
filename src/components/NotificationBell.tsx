import { useState, useRef, useEffect } from 'react'
import { Bell, X, User, Cake } from 'lucide-react'
import { useBirthdayNotifications } from '../hooks/useBirthdayNotifications'

export function NotificationBell({ unitId }: { unitId: string }) {
    const { notifications, count, dismissNotification } = useBirthdayNotifications(unitId)
    const [isOpen, setIsOpen] = useState(false)
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

    if (count === 0 && !isOpen) return null

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                title="Birthday alerts"
            >
                <Bell className="h-5 w-5 text-white" />
                {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-2xs font-bold text-white ring-2 ring-background-dark">
                        {count}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-surface-dark border border-border-dark p-2 shadow-2xl shadow-black/40 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border-dark mb-1">
                        <h3 className="text-2xs font-bold uppercase tracking-spaced text-slate-400">
                            Birthday Alerts
                        </h3>
                        {count === 0 && (
                            <span className="text-2xs text-slate-500">All clear</span>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto flex flex-col gap-0.5">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <Cake className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                                <p className="text-sm text-slate-400">No new alerts</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="group relative flex items-start gap-3 rounded-xl p-2.5 hover:bg-white/5 transition-colors"
                                >
                                    <div className="size-8 flex items-center justify-center rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 flex-shrink-0">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className="text-sm font-semibold text-slate-100 truncate">
                                            {n.member_name}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {n.type === 'birthday_eve' ? 'Birthday tomorrow!' : 'Birthday today! 🎉'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => dismissNotification(n.id)}
                                        className="absolute right-1.5 top-1.5 p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors"
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
