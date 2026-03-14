import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Pencil, Users, Upload, Download, X, CheckCircle2, ChevronRight, Cake } from 'lucide-react'
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
  member, onEdit, onDelete, onView,
}: {
  member: Member
  onEdit: (m: Member) => void
  onDelete: (id: string) => void
  onView: () => void
}) {
  return (
    <div
      className="flex items-center border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors group"
      onClick={onView}
    >
      <div className="flex-1 min-w-0 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
          {member.section && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
              {member.section}
            </span>
          )}
          {member.status === 'inactive' && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Inactive</span>
          )}
          {isBirthdayToday(member.birthday) && (
            <span title="Birthday Today! 🎂" className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-100 text-pink-600 animate-pulse">
              <Cake className="h-3 w-3" />
            </span>
          )}
        </div>
        {member.phone && <p className="text-xs text-gray-400 mt-0.5">{member.phone}</p>}
      </div>
      <div className="flex items-center gap-1 pr-2 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onEdit(member) }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(member.id) }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
      </div>
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
    supabase.from('units').select('name').eq('id', unitId).single().then(({ data }) => {
      if (data) setUnitName(data.name)
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
    <div className="min-h-screen bg-gray-50">
      {/* Hidden file input for CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <header className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-20 border-b border-gray-100">
        <button
          onClick={() => navigate(`/admin/units/${unitId}`)}
          className="flex items-center justify-center rounded-xl p-2 hover:bg-gray-100 transition-colors"
          title="Back to Unit"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{unitName}</p>
          <p className="text-xs text-gray-400">
            Members ({members.filter(m => m.status === 'active').length} active)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openImport}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4">

        {/* ── Add / Edit form ─────────────────────────────────────────────── */}
        {panel === 'add' && (
          <form
            onSubmit={handleSave}
            className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {editing ? 'Edit Member' : 'Add Member'}
              </h3>
              <button type="button" onClick={closeForm} className="text-gray-300 hover:text-gray-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Input
              label="Full name"
              placeholder="John Doe"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />

            <div className="flex gap-3">
              <Input
                label="Phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={form.phone ?? ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="flex-1"
              />
              <Input
                label="Section / Group"
                placeholder="e.g. Soprano, Senior"
                value={form.section ?? ''}
                onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                className="flex-1"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="member-status" className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="member-status"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as MemberStatus }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <Input
                label="Birthday"
                type="date"
                value={form.birthday ?? ''}
                onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
                className="flex-1"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" type="button" onClick={closeForm}>
                Cancel
              </Button>
              <Button size="sm" type="submit" loading={saving}>
                {editing ? 'Save Changes' : 'Add Member'}
              </Button>
            </div>
          </form>
        )}

        {/* ── CSV import panel ─────────────────────────────────────────────── */}
        {panel === 'import' && (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 flex flex-col gap-4">
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
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-semibold text-gray-900">
                  {importDone} member{importDone !== 1 ? 's' : ''} imported
                </p>
                <Button size="sm" onClick={() => setPanel('none')}>Done</Button>
              </div>
            )}

            {/* No file chosen yet */}
            {importDone === null && !csvFilename && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Upload className="h-10 w-10 text-gray-200" />
                <div>
                  <p className="text-sm text-gray-600">No file selected</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click "Choose file" to pick a CSV, or download the template first.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadTemplate}
                  >
                    <Download className="h-4 w-4" /> Download template
                  </Button>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose file
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

                <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Section</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Birthday</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr
                          key={i}
                          className={`border-t border-gray-50 transition-colors ${r.duplicateStatus === 'exact' ? 'bg-red-50' :
                            r.duplicateStatus === 'fuzzy' ? 'bg-amber-50' : 'hover:bg-gray-50'
                            }`}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900">
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
        <input
          type="search"
          placeholder="Search members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />

        {/* ── Member list ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-gray-100">
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
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([section, sectionMembers]) => (
              <div key={section}>
                {section && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 px-1">
                    {section}
                  </p>
                )}
                <div className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden">
                  {sectionMembers.map(m => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onView={() => navigate(`/admin/units/${unitId}/members/${m.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
            
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button 
                  variant="secondary" 
                  onClick={loadMore} 
                  loading={loadingMore}
                  className="w-full sm:w-auto"
                >
                  Load More Members
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
