import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MemberNotification } from '../types'

export function useBirthdayNotifications(unitId: string | undefined) {
    const [notifications, setNotifications] = useState<MemberNotification[]>([])
    const [loading, setLoading] = useState(true)

    const fetchNotifications = useCallback(async () => {
        if (!unitId) return
        const { data, error } = await supabase.rpc('get_pending_notifications', { p_unit_id: unitId })
        if (!error && data) {
            setNotifications(data)
        }
        setLoading(false)
    }, [unitId])

    const dismissNotification = async (id: string) => {
        const { error } = await supabase
            .from('member_notifications')
            .update({ dismissed: true })
            .eq('id', id)

        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id))
        }
    }

    useEffect(() => {
        fetchNotifications()

        // Poll every 5 minutes
        const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    return {
        notifications,
        loading,
        dismissNotification,
        count: notifications.length,
        refresh: fetchNotifications,
    }
}
