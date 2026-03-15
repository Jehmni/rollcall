import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Pencil, Users, Upload, Download, X, CheckCircle2, ChevronRight, Cake, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Member, MemberStatus } from '../types'
import { detectDuplicate, type DuplicateStatus } from '../lib/nameUtils'

// ─── CSV import ───────────────────────────────────────────────────────────────

interface CsvRow {
  name: string
  phone: string | null
  section: string | null
  status: MemberStatus
  birthday: string | null
  duplicateStatus: DuplicateStatus
}

/** Parse a CSV string into import-ready rows. Handles quoted fields and an optional header. */
function parseCsv(text: string): { rows: CsvRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { rows: [], skipped: 0 }

  // Split a single CSV line, respecting double-quoted fields
  function splitLine(line: string): string[] {
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    return cells
  }

  // Skip header if first cell looks like a column label
  const firstCell = splitLine(lines[0])[0].toLowerCase()
  const startIdx = (firstCell === 'name' || firstCell === 'full name' || firstCell === 'member') ? 1 : 0

  const rows: CsvRow[] = []
  let skipped = 0

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitLine(lines[i])
    const name = cols[0]?.trim()
    if (!name) { skipped++; continue }
    const rawStatus = cols[3]?.trim().toLowerCase()
    rows.push({
      name,
      phone: cols[1]?.trim() || null,
      section: cols[2]?.trim() || null,
      status: rawStatus === 'inactive' ? 'inactive' : 'active',
      birthday: cols[4]?.trim() || null,
      duplicateStatus: 'ok',
    })
  }

  return { rows, skipped }
}

function downloadTemplate() {
  const csv = [
    'Name,Phone,Section,Status,Birthday',
    'Alice Johnson,+2348001234567,Soprano,active,1990-05-14',
    'Bob Smith,,Bass,active,1985-11-20',
    'Carol Williams,+2348009876543,Alto,active,',
  ].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'members-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ─── Member row ───────────────────────────────────────────────────────────────

function isBirthdayToday(birthday: string | null) {
  if (!birthday) return false
  const today = new Date()
  const bday = new Date(birthday)
  return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()
}

function MemberRow({
  member, canManage, onEdit, onDelete, onView,
}: {
  member: Member
  canManage: boolean
  onEdit: (m: Member) => void
  onDelete: (id: string) => void
  onView: () => void
}) {
  return (
    <div
      className="flex items-center border-b border-brand-border/30 last:border-0 cursor-pointer hover:bg-brand-primary/[0.02] transition-all group active:scale-[0.99] relative overflow-hidden"
      onClick={onView}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-brand-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-500"></div>
      
      <div className="flex-1 min-w-0 px-5 sm:px-8 py-6 sm:py-7">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
             <p className="text-xl font-bold text-brand-text tracking-tight uppercase italic group-hover:text-brand-primary transition-colors">{member.name}</p>
             <div className="flex items-center gap-3 mt-1.5">
                {member.section && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary opacity-60">
                    {member.section}
                  </span>
                )}
                {member.section && member.phone && <span className="text-brand-slate/20 text-[10px]">/</span>}
                {member.phone && <p className="text-[10px] font-bold text-brand-slate opacity-40 uppercase tracking-widest">{member.phone}</p>}
                {isBirthdayToday(member.birthday) && (
                  <span title="Birthday Today! 🎂" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-pink-600 bg-pink-50 px-2 py-1 rounded-lg border border-pink-100 ml-2 animate-pulse">
                    <Cake className="h-3 w-3" /> Celebration
                  </span>
                )}
             </div>
          </div>
          {member.status === 'inactive' && (
            <span className="rounded-full bg-brand-secondary px-3 py-1 text-[8px] font-black uppercase tracking-widest text-brand-slate/40 border border-brand-border/50">Retired</span>
          )}
        </div>
      </div>
      
      {canManage && (
        <div className="flex items-center gap-1.5 pr-4 sm:pr-6 flex-shrink-0 relative z-10 transition-all duration-300 opacity-20 group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onEdit(member) }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-brand-slate hover:bg-brand-primary hover:text-white border border-transparent hover:border-brand-primary transition-all active:scale-90"
            title="Refine Identity"
          >
            <Pencil className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(member.id) }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-brand-slate/40 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500 transition-all active:scale-90"
            title="Decommission"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <div className="h-10 w-px bg-brand-border/30 mx-2"></div>
          <div className="flex h-11 w-11 items-center justify-center text-brand-slate/20 group-hover:text-brand-primary group-hover:translate-x-1 transition-all">
             <ChevronRight className="h-6 w-6" />
          </div>
        </div>
      )}
      {!canManage && (
        <div className="flex items-center gap-1 pr-8 flex-shrink-0">
          <ChevronRight className="h-6 w-6 text-brand-slate opacity-20 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY: Omit<Member, 'id' | 'unit_id' | 'created_at'> = {
  name: '', phone: '', section: '', status: 'active', birthday: '',
}

type Panel = 'none' | 'add' | 'import'

export default function UnitMembers() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isOwnerOrCreator, setIsOwnerOrCreator] = useState(false)

  const [unitName, setUnitName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [panel, setPanel] = useState<Panel>('none')

  // Single-member form
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // CSV import
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvSkipped, setCsvSkipped] = useState(0)
  const [csvFilename, setCsvFilename] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDone, setImportDone] = useState<number | null>(null)

  const PAGE_SIZE = 50

  const fetchMembers = useCallback(async (pageToFetch: number, isNewSearch: boolean = false) => {
    if (!unitId) return
    if (pageToFetch === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      let query = supabase
        .from('members')
        .select('*')
        .eq('unit_id', unitId)
        .order('section', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
        .range(pageToFetch * PAGE_SIZE, (pageToFetch + 1) * PAGE_SIZE - 1)

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,section.ilike.%${search.trim()}%`)
      }

      const { data, error } = await query

      if (error) throw error

      if (isNewSearch) {
        setMembers(data ?? [])
        setPage(0)
      } else {
        setMembers(prev => [...prev, ...(data ?? [])])
        setPage(pageToFetch)
      }
      
      setHasMore((data ?? []).length === PAGE_SIZE)
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [unitId, search])

  useEffect(() => {
    if (!unitId) return
    supabase
      .from('units')
      .select('*, organization:organizations(*, organization_members(role, admin_id))')
      .eq('id', unitId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setUnitName(data.name)
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const org = data.organization as any
            const members = org?.organization_members as any[]
            const myMember = members?.find(m => m.admin_id === user.id)
            const role = myMember?.role || 'member'
            
            // Check if super admin, org owner, or unit creator
            const { data: isSuper } = await supabase.rpc('is_super_admin')
            setIsOwnerOrCreator(isSuper || role === 'owner' || data.created_by_admin_id === user.id)
          }
        }
      })
    fetchMembers(0, true)
  }, [unitId, fetchMembers])

  // Refetch when search changes (debounced search would be better, but let's start simple)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (unitId) fetchMembers(0, true)
    }, 400)
    return () => clearTimeout(timer)
  }, [search, unitId, fetchMembers])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMembers(page + 1)
    }
  }

  // ── Single member form ──────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null); setForm(EMPTY); setFormError(null); setPanel('add')
  }

  function openEdit(m: Member) {
    setEditing(m)
    setForm({
      name: m.name,
      phone: m.phone ?? '',
      section: m.section ?? '',
      status: m.status,
      birthday: m.birthday ?? '',
    })
    setFormError(null)
    setPanel('add')
  }

  function closeForm() {
    setPanel('none'); setEditing(null); setFormError(null)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setFormError(null); setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone?.trim() || null,
      section: form.section?.trim() || null,
      status: form.status,
      birthday: form.birthday || null,
    }
    try {
      if (editing) {
        const { error } = await supabase.from('members').update(payload).eq('id', editing.id)
        if (error) throw error
        setMembers(prev => prev.map(m => m.id === editing.id ? { ...m, ...payload } : m))
      } else {
        const { data, error } = await supabase
          .from('members').insert({ ...payload, unit_id: unitId }).select().single()
        if (error) throw error
        setMembers(prev =>
          [...prev, data].sort((a, b) =>
            (a.section ?? '').localeCompare(b.section ?? '') || a.name.localeCompare(b.name)
          )
        )
      }
      closeForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this member?')) return
    await supabase.from('members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  // ── CSV import ──────────────────────────────────────────────────────────────

  function openImport() {
    setImportDone(null); setImportError(null); setCsvRows([]); setCsvFilename('')
    setPanel('import')
    // Delay so panel renders before we click the file input
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { setPanel('none'); return }
    setCsvFilename(file.name)
    const reader = new FileReader()
    reader.onload = async ev => {
      const text = ev.target?.result as string
      const { rows, skipped } = parseCsv(text)

      // Fetch ALL names for this unit to check duplicates properly (paginated 'members' isn't enough)
      const { data: allNames } = await supabase
        .from('members')
        .select('name')
        .eq('unit_id', unitId)

      const existingNames = (allNames ?? []).map(m => m.name)
      const annotated = rows.map(row => ({
        ...row,
        duplicateStatus: detectDuplicate(row.name, existingNames),
      }))

      setCsvRows(annotated)
      setCsvSkipped(skipped)
      setImportError(annotated.length === 0 ? 'No valid rows found in this file.' : null)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected after editing
    e.target.value = ''
  }

  async function handleImport() {
    if (!unitId || csvRows.length === 0) return
    setImporting(true); setImportError(null)
    try {
      const payload = csvRows
        .filter(r => r.duplicateStatus !== 'exact')
        .map(r => ({
          unit_id: unitId,
          name: r.name,
          phone: r.phone,
          section: r.section,
          status: r.status,
          birthday: r.birthday,
        }))
      const { data, error } = await supabase.from('members').insert(payload).select()
      if (error) throw error
      const inserted = (data ?? []) as Member[]
      setMembers(prev =>
        [...prev, ...inserted].sort((a, b) =>
          (a.section ?? '').localeCompare(b.section ?? '') || a.name.localeCompare(b.name)
        )
      )
      setImportDone(inserted.length)
      setCsvRows([])
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Filtered / grouped list ─────────────────────────────────────────────────

  const filtered = members

  const sections = [...new Set(filtered.map(m => m.section ?? ''))].sort((a, b) => {
    if (!a) return 1
    if (!b) return -1
    return a.localeCompare(b)
  })
  const grouped = sections.reduce<Record<string, Member[]>>((acc, s) => {
    acc[s] = filtered.filter(m => (m.section ?? '') === s)
    return acc
  }, {})

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-secondary">
      {/* Hidden file input for CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <header className="flex flex-col gap-8 px-5 sm:px-8 pt-24 pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate(`/admin/units/${unitId}`)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
            title="Back to Unit"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          
          <div className="flex flex-col items-center flex-1 overflow-hidden px-4 text-center">
             <h1 className="text-3xl font-black tracking-tighter italic truncate w-full">{unitName}</h1>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mt-1">
               Roster Management
             </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/20">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
           <div className="flex h-12 items-center px-6 rounded-2xl bg-white/10 border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                {members.filter(m => m.status === 'active').length} Active Members
              </p>
           </div>
           {isOwnerOrCreator && (
            <>
              <button
                 onClick={openImport}
                 className="flex items-center gap-3 h-12 px-6 rounded-2xl bg-white/10 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/20 transition-all active:scale-95"
              >
                <Upload className="h-4 w-4" /> Import
              </button>
              <button
                 onClick={openCreate}
                 className="flex items-center gap-3 h-12 px-8 rounded-2xl bg-white text-brand-primary shadow-xl shadow-brand-primary/20 border border-white font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all active:scale-95"
              >
                <Plus className="h-5 w-5" /> Add New
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-6 flex flex-col gap-4">

        {/* ── Add / Edit form ─────────────────────────────────────────────── */}
        {panel === 'add' && (
          <div className="rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl shadow-brand-primary/5 border border-brand-border/50 animate-in fade-in slide-in-from-top-6 duration-700 relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl"></div>
            <form onSubmit={handleSave} className="flex flex-col gap-8 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="h-14 w-14 bg-brand-primary shadow-lg shadow-brand-primary/20 rounded-2xl flex items-center justify-center text-white">
                    <Users className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">
                      {editing ? 'Edit Member' : 'New Member'}
                    </h3>
                    <p className="text-sm font-medium text-brand-slate opacity-40">Command member profile details</p>
                  </div>
                </div>
                <button type="button" onClick={closeForm} className="h-10 w-10 flex items-center justify-center rounded-xl bg-brand-secondary text-brand-slate hover:text-brand-text transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <Input
                  label="Full Name"
                  placeholder="e.g. Johnathan Doe"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                  className="text-lg py-6"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={form.phone ?? ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  <Input
                    label="Section / Group"
                    placeholder="e.g. Soprano, Tenor, Staff"
                    value={form.section ?? ''}
                    onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 ml-1">Member Status</label>
                    <select
                      className="w-full rounded-2xl border border-brand-border bg-brand-secondary/30 px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all font-bold h-[62px] text-brand-text appearance-none cursor-pointer hover:border-brand-primary/30"
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as MemberStatus }))}
                    >
                      <option value="active">Active Duty</option>
                      <option value="inactive">Retired / Inactive</option>
                    </select>
                  </div>
                  <Input
                    label="Birthday"
                    type="date"
                    value={form.birthday ?? ''}
                    onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
                  />
                </div>
              </div>

              {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

              <div className="flex gap-4 justify-end pt-4">
                <Button variant="ghost" size="lg" type="button" onClick={closeForm} className="text-xs font-black uppercase tracking-[0.2em] opacity-40">
                  Cancel
                </Button>
                <Button size="lg" type="submit" loading={saving} className="px-10 shadow-xl shadow-brand-primary/20 text-xs font-black uppercase tracking-[0.2em] rounded-2xl">
                  {editing ? 'Update Profile' : 'Enlist Member'}
                </Button>
              </div>
            </form>
          </div>
        )}

         {/* ── CSV import panel ─────────────────────────────────────────────── */}
        {panel === 'import' && (
          <div className="rounded-2xl bg-white p-4 sm:p-5 border border-brand-border flex flex-col gap-4 shadow-xl shadow-brand-slate/5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Import from CSV</h3>
                {csvFilename && (
                  <p className="text-xs text-gray-400 mt-0.5">{csvFilename}</p>
                )}
              </div>
              <button
                onClick={() => setPanel('none')}
                className="text-gray-300 hover:text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success state */}
            {importDone !== null && (
              <div className="flex flex-col items-center gap-10 py-12 text-center animate-in zoom-in-95 duration-700">
                <div className="relative">
                   <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse"></div>
                   <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-green-500 shadow-2xl shadow-green-500/40">
                      <CheckCircle2 className="h-10 w-10 text-white" />
                   </div>
                </div>
                <div>
                   <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Transfer Complete</h3>
                   <p className="text-sm font-medium text-brand-slate opacity-40 mt-2">
                     {importDone} member{importDone !== 1 ? 's' : ''} have been successfully integrated into the roster.
                   </p>
                </div>
                <Button size="lg" onClick={() => setPanel('none')} className="px-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20">
                   Log Entry
                </Button>
              </div>
            )}

            {/* No file chosen yet */}
            {importDone === null && !csvFilename && (
              <div className="flex flex-col items-center gap-8 py-12 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-primary/5 blur-3xl rounded-full translate-y-1/2"></div>
                <div className="h-20 w-20 flex items-center justify-center rounded-[1.5rem] bg-brand-primary/5 text-brand-primary relative z-10 transition-all group-hover:scale-110">
                   <Upload className="h-10 w-10" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Upload Roster</h3>
                  <p className="text-sm font-medium text-brand-slate opacity-40 mt-2 max-w-[250px] mx-auto">
                    Select a CSV payload to mass-enlist members into this node.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-[280px] relative z-10">
                  <Button size="lg" onClick={() => fileInputRef.current?.click()} className="w-full h-14 rounded-2xl shadow-xl shadow-brand-primary/20 text-[10px] font-black uppercase tracking-[0.2em]">
                    Choose Payload
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadTemplate}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100"
                  >
                    <Download className="h-4 w-4 mr-2" /> Download Blueprint
                  </Button>
                </div>
              </div>
            )}

            {/* Parse error */}
            {importDone === null && csvFilename && importError && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
                {importError}
              </div>
            )}

            {/* Preview table */}
            {importDone === null && csvRows.length > 0 && (
              <>
                <div className="text-xs text-gray-500">
                  {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} ready to import
                  {csvSkipped > 0 && (
                    <span className="ml-1 text-amber-600">
                      · {csvSkipped} row{csvSkipped !== 1 ? 's' : ''} skipped (empty name)
                    </span>
                  )}
                </div>

                 <div className="overflow-x-auto rounded-[1.5rem] border border-brand-border/50 bg-brand-secondary/30 backdrop-blur-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand-primary/5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate/40">
                        <th className="px-6 py-4">Structure Name</th>
                        <th className="px-6 py-4">Protocol</th>
                        <th className="px-6 py-4">Node</th>
                        <th className="px-6 py-4">State</th>
                        <th className="px-6 py-4">Timeline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/30">
                       {csvRows.map((r, i) => (
                        <tr
                          key={i}
                          className={`border-t border-gray-50 transition-colors whitespace-nowrap ${r.duplicateStatus === 'exact' ? 'bg-red-50' :
                             r.duplicateStatus === 'fuzzy' ? 'bg-amber-50' : 'hover:bg-gray-50'
                             }`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 min-w-[150px]">
                            {r.name}
                            {r.duplicateStatus === 'exact' && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                                Duplicate
                              </span>
                            )}
                            {r.duplicateStatus === 'fuzzy' && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                Similar name
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.phone ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.section ?? '—'}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.status === 'active'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                                }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.birthday ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2">
                  {csvRows.filter(r => r.duplicateStatus === 'exact').length > 0 && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                      {csvRows.filter(r => r.duplicateStatus === 'exact').length} row(s) match existing members exactly and will be skipped.
                    </p>
                  )}
                  {csvRows.filter(r => r.duplicateStatus === 'fuzzy').length > 0 && (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {csvRows.filter(r => r.duplicateStatus === 'fuzzy').length} row(s) have names similar to existing members.
                    </p>
                  )}
                  {importError && (
                    <p className="text-sm text-red-600">{importError}</p>
                  )}

                  <div className="flex gap-2 justify-between">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose different file
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setPanel('none')}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        loading={importing}
                        onClick={handleImport}
                        disabled={csvRows.length === 0 || csvRows.filter(r => r.duplicateStatus !== 'exact').length === 0}
                      >
                        Import {csvRows.filter(r => r.duplicateStatus !== 'exact').length} member{csvRows.filter(r => r.duplicateStatus !== 'exact').length !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* CSV format hint */}
            {importDone === null && (
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-600 select-none">
                  Expected CSV format
                </summary>
                <pre className="mt-2 rounded-lg bg-gray-50 p-3 font-mono leading-relaxed text-gray-500 overflow-x-auto">
                  {`Name,Phone,Section,Status,Birthday
Alice Johnson,+2348001234567,Soprano,active,1990-05-14
Bob Smith,,Bass,active,1985-11-20`}
                </pre>
                <p className="mt-1">Phone, Section, Status, and Birthday are optional. Status defaults to "active".</p>
              </details>
            )}
          </div>
        )}

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="relative group">
          <Input
            type="search"
            placeholder="Search roster by name or section…"
            value={search}
            onChange={e => setSearch(e.target.value)}
             className="w-full rounded-3xl bg-white border-brand-border/50 px-6 sm:px-8 py-6 sm:py-7 shadow-2xl shadow-brand-primary/5 focus:border-brand-primary/50 transition-all text-lg placeholder:text-brand-slate/30"
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-brand-primary/5 text-brand-primary opacity-40 group-focus-within:opacity-100 transition-all">
            <Search className="h-5 w-5" />
          </div>
        </div>

        {/* ── Member list ─────────────────────────────────────────────────── */}
         {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          </div>
         ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center border border-brand-border">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="font-medium text-gray-600">
              {search ? 'No members match your search' : 'No members yet'}
            </p>
            {!search && (
              <p className="mt-1 text-sm text-gray-400">
                Add members manually or import a CSV file.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {Object.entries(grouped).map(([section, sectionMembers]) => (
              <div key={section} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-4 px-2">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
                    {section || 'Unassigned'}
                  </h3>
                  <div className="h-px flex-1 bg-brand-border/30"></div>
                  <span className="text-[10px] font-black text-brand-primary/40 bg-brand-primary/5 px-2 py-0.5 rounded-md border border-brand-primary/10">{sectionMembers.length}</span>
                </div>
                <div className="rounded-[2rem] bg-white border border-brand-border/50 overflow-hidden shadow-2xl shadow-brand-primary/[0.02]">
                  {sectionMembers.map(m => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      canManage={isOwnerOrCreator}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onView={() => navigate(`/admin/units/${unitId}/members/${m.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
            
            {hasMore && (
              <div className="flex justify-center pt-12">
                <Button 
                   onClick={loadMore} 
                   loading={loadingMore}
                   className="w-full h-16 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-xl shadow-brand-primary/10 border-brand-border/50 bg-white text-brand-primary hover:bg-brand-primary hover:text-white transition-all active:scale-[0.98]"
                >
                  Retrieve Further Intel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
