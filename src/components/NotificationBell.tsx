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
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
            >
                <Bell className="h-5 w-5" />
                {count > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {count}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-white p-2 shadow-xl ring-1 ring-gray-100 z-50">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50 mb-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Birthday Alerts
                        </h3>
                        {count === 0 && (
                            <span className="text-[10px] text-gray-300">All caught up!</span>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto flex flex-col gap-1">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <Cake className="mx-auto h-8 w-8 text-gray-100 mb-2" />
                                <p className="text-sm text-gray-400">No new alerts</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className="group relative flex items-start gap-3 rounded-xl p-2.5 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-pink-500 flex-shrink-0">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-6">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {n.member_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {n.type === 'birthday_eve' ? "Birthday tomorrow!" : "Birthday today! 🎉"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => dismissNotification(n.id)}
                                        className="absolute right-1 top-1 p-1.5 text-gray-300 hover:text-gray-500 rounded-lg hover:bg-white transition-opacity"
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
