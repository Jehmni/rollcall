import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import type { DashboardMember, Organization, OrgRole, Service, Unit } from '../types'

// ── Organizations ────────────────────────────────────────────────────────────

export function useOrganizations() {
  const [orgs, setOrgs] = useState<(Organization & { userRole: OrgRole })[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch organizations where the current user is a member
    const { data } = await supabase
      .from('organizations')
      .select(`
        *,
        organization_members!inner(role)
      `)
      .eq('organization_members.admin_id', user.id)
      .order('name')
    
    const transformed = (data ?? []).map((o: Organization & { organization_members: { role: OrgRole }[] }) => ({
      ...o,
      userRole: o.organization_members[0]?.role || 'member'
    }))

    setOrgs(transformed)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createOrg(name: string): Promise<Organization> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Authentication required')

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        created_by_admin_id: user.id
      })
      .select()
      .single()

    if (error) throw error

    // The handle_new_organization() DB trigger automatically inserts the creator
    // into organization_members with role='owner' (security definer, bypasses RLS).
    // No manual insert needed here.

    await fetch()
    return data
  }

  async function updateOrg(id: string, name: string): Promise<Organization> {
    const { data, error } = await supabase.from('organizations').update({ name }).eq('id', id).select().single()
    if (error) throw error
    await fetch()
    return data
  }

  async function deleteOrg(id: string) {
    await supabase.from('organizations').delete().eq('id', id)
    setOrgs(prev => prev.filter(o => o.id !== id))
  }

  return { orgs, loading, createOrg, updateOrg, deleteOrg, refetch: fetch }
}

// ── Units ────────────────────────────────────────────────────────────────────


export function useUnits(orgId: string | null) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) { setUnits([]); setLoading(false); return }
    const { data } = await supabase.from('units').select('*').eq('org_id', orgId).order('name')
    setUnits(data ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { setLoading(true); fetch() }, [fetch])

  async function createUnit(name: string, description?: string): Promise<Unit> {
    if (!orgId) throw new Error('No org selected')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Authentication required')

    const { data, error } = await supabase
      .from('units')
      .insert({ 
        org_id: orgId, 
        name, 
        description: description ?? null,
        created_by_admin_id: user.id
      })
      .select()
      .single()
    if (error) throw error
    setUnits(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  async function updateUnit(
    id: string,
    name: string,
    description?: string,
    location?: { latitude: number | null; longitude: number | null; radius_meters: number | null },
  ): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .update({
        name,
        description: description ?? null,
        ...(location !== undefined ? location : {}),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setUnits(prev => prev.map(u => u.id === id ? data : u).sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  async function deleteUnit(id: string) {
    await supabase.from('units').delete().eq('id', id)
    setUnits(prev => prev.filter(u => u.id !== id))
  }

  return { units, loading, createUnit, updateUnit, deleteUnit, refetch: fetch }
}

// ── Unit Admins ───────────────────────────────────────────────────────────────

export interface UnitAdmin {
  id: string
  user_id: string
  email: string
  created_at: string
}

export function useUnitAdmins(unitId: string | null) {
  const [admins, setAdmins] = useState<UnitAdmin[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!unitId) { setAdmins([]); setLoading(false); return }
    const { data } = await supabase
      .from('unit_admins')
      .select('id, user_id, created_at')
      .eq('unit_id', unitId)
    setAdmins(
      (data ?? []).map((r: { id: string; user_id: string; created_at: string }) => ({
        id: r.id,
        user_id: r.user_id,
        email: '—',        // email not directly joinable without service role
        created_at: r.created_at,
      })),
    )
    setLoading(false)
  }, [unitId])

  useEffect(() => { setLoading(true); fetch() }, [fetch])

  async function addAdmin(email: string) {
    const { data, error } = await supabase.rpc('add_unit_admin_by_email', {
      p_unit_id: unitId,
      p_email: email,
    })
    if (error) throw error
    const result = data as { success: boolean; error?: string }
    if (!result.success) throw new Error(result.error ?? 'Failed to add admin')
    await fetch()
  }

  async function removeAdmin(id: string) {
    await supabase.from('unit_admins').delete().eq('id', id)
    setAdmins(prev => prev.filter(a => a.id !== id))
  }

  return { admins, loading, addAdmin, removeAdmin }
}

// ── Services ─────────────────────────────────────────────────────────────────

export function useServices(unitId: string | null) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!unitId) { setServices([]); setLoading(false); return }
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('unit_id', unitId)
      .order('date', { ascending: false })
    setServices(data ?? [])
    setLoading(false)
  }, [unitId])

  useEffect(() => { setLoading(true); fetch() }, [fetch])

  async function createService(date: string, service_type: string, require_location = false): Promise<Service> {
    if (!unitId) throw new Error('No unit selected')
    const { data, error } = await supabase
      .from('services')
      .insert({ unit_id: unitId, date, service_type, require_location })
      .select()
      .single()
    if (error) throw error
    setServices(prev => [data, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
    return data
  }

  async function updateService(id: string, date: string, service_type: string, require_location = false): Promise<Service> {
    const { data, error } = await supabase
      .from('services')
      .update({ date, service_type, require_location })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setServices(prev => prev.map(s => s.id === id ? data : s).sort((a, b) => b.date.localeCompare(a.date)))
    return data
  }

  async function deleteService(id: string): Promise<void> {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) throw error
    setServices(prev => prev.filter(s => s.id !== id))
  }

  return { services, loading, createService, updateService, deleteService, refetch: fetch }
}

// ── Dashboard (attendance for a service) ─────────────────────────────────────

export function useAdminDashboard(serviceId: string | null) {
  const { toast } = useToast()
  const [members, setMembers] = useState<DashboardMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  const PAGE_SIZE = 100

  const fetchCount = useCallback(async () => {
    if (!serviceId) return
    const { data: service } = await supabase.from('services').select('unit_id').eq('id', serviceId).single()
    if (!service) return
    const { count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('unit_id', service.unit_id)
      .eq('status', 'active')
    setTotal(count ?? 0)
  }, [serviceId])

  const fetchMembers = useCallback(async (pageToFetch: number, isNew: boolean = false) => {
    if (!serviceId) { setMembers([]); setLoading(false); return }
    
    if (pageToFetch === 0) {
      setLoading(true)
      fetchCount() // Refresh total count
    } else {
      setLoadingMore(true)
    }

    const { data, error } = await supabase.rpc('get_service_members_full', { 
      p_service_id: serviceId,
      p_limit: PAGE_SIZE,
      p_offset: pageToFetch * PAGE_SIZE
    })

    if (error) {
      toast('Failed to load attendance data. Please refresh.', 'error')
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const newMembers = (data ?? []) as DashboardMember[]
    
    if (isNew) {
      setMembers(newMembers)
      setPage(0)
    } else {
      setMembers(prev => [...prev, ...newMembers])
      setPage(pageToFetch)
    }
    
    setHasMore(newMembers.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [serviceId, fetchCount, toast])

  useEffect(() => { fetchMembers(0, true) }, [fetchMembers])

  useEffect(() => {
    if (!serviceId) return
    const channel = supabase
      .channel(`attendance-${serviceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance', filter: `service_id=eq.${serviceId}` },
        (payload) => {
          const rec = payload.new as { member_id: string; checkin_time: string }
          setMembers(prev =>
            prev.map(m => m.id === rec.member_id ? { ...m, checked_in: true, checkin_time: rec.checkin_time } : m),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'attendance', filter: `service_id=eq.${serviceId}` },
        (payload) => {
          const old = payload.old as { member_id: string }
          setMembers(prev =>
            prev.map(m => m.id === old.member_id ? { ...m, checked_in: false, checkin_time: null } : m),
          )
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [serviceId])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMembers(page + 1)
    }
  }

  const present = members.filter(m => m.checked_in)
  const absent = members.filter(m => !m.checked_in)

  async function markAttendance(memberId: string, present: boolean) {
    if (!serviceId) return
    if (present) {
      const { error } = await supabase
        .from('attendance')
        .insert({
          service_id: serviceId,
          member_id: memberId,
          checkin_time: new Date().toISOString()
        })
      if (error && error.code !== '23505') throw error
    } else {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('service_id', serviceId)
        .eq('member_id', memberId)
      if (error) throw error
    }
    // Optimistic update
    setMembers(prev => prev.map(m => 
      m.id === memberId 
        ? { ...m, checked_in: present, checkin_time: present ? new Date().toISOString() : null } 
        : m
    ))
  }

  return { 
    members, 
    present, 
    absent, 
    total, 
    loading, 
    loadingMore, 
    hasMore, 
    loadMore, 
    markAttendance,
    refetch: () => fetchMembers(0, true) 
  }
}

// ── Organisation Analytics ────────────────────────────────────────────────────

export interface UnitStats {
  unitId: string
  memberCount: number       // active members in this unit
  sessionCount: number      // services in the last 30 days
}

export interface OrgStats {
  totalMembers: number      // all active members across all units
  totalUnits: number        // number of units
  unitStats: Record<string, UnitStats>  // keyed by unit id
}

export function useOrgStats(orgId: string | null, unitIds: string[]) {
  const [stats, setStats] = useState<OrgStats>({
    totalMembers: 0,
    totalUnits: 0,
    unitStats: {},
  })
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!orgId || unitIds.length === 0) {
      setStats({ totalMembers: 0, totalUnits: unitIds.length, unitStats: {} })
      return
    }
    setLoading(true)

    // Fetch all active members for all units in one query
    const { data: members } = await supabase
      .from('members')
      .select('unit_id')
      .in('unit_id', unitIds)
      .eq('status', 'active')

    // Fetch all services from the last 30 days for these units
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const { data: services } = await supabase
      .from('services')
      .select('unit_id')
      .in('unit_id', unitIds)
      .gte('date', since.toISOString().slice(0, 10))

    // Aggregate
    const unitStats: Record<string, UnitStats> = {}
    for (const id of unitIds) {
      unitStats[id] = { unitId: id, memberCount: 0, sessionCount: 0 }
    }
    for (const m of (members ?? [])) {
      if (unitStats[m.unit_id]) unitStats[m.unit_id].memberCount++
    }
    for (const s of (services ?? [])) {
      if (unitStats[s.unit_id]) unitStats[s.unit_id].sessionCount++
    }

    const totalMembers = Object.values(unitStats).reduce((sum, s) => sum + s.memberCount, 0)

    setStats({ totalMembers, totalUnits: unitIds.length, unitStats })
    setLoading(false)
  }, [orgId, unitIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch() }, [fetch])

  return { stats, loading, refetch: fetch }
}

