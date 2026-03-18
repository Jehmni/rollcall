import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Member, MemberStatus } from '../types'
import { detectDuplicate, type DuplicateStatus } from '../lib/nameUtils'

// ─── CSV import helpers ───────────────────────────────────────────────────────

interface CsvRow {
  name: string
  phone: string | null
  section: string | null
  status: MemberStatus
  birthday: string | null
  duplicateStatus: DuplicateStatus
}

function splitCsvLine(line: string): string[] {
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

/** Normalise a date string to ISO YYYY-MM-DD. Handles DD/MM/YYYY and MM/DD/YYYY heuristically. */
function normaliseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or MM/DD/YYYY  →  prefer DD/MM/YYYY (common outside US)
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (slashMatch) {
    const [, d, m, y] = slashMatch
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

/** Detect which column index corresponds to each logical field from a header row. */
function detectColumns(headers: string[]): Record<string, number> {
  const h = headers.map(c => c.toLowerCase().trim())
  const find = (...needles: string[]): number => {
    for (const needle of needles) {
      const idx = h.findIndex(col => col.includes(needle))
      if (idx !== -1) return idx
    }
    return -1
  }
  return {
    name:     find('full name', 'fullname', 'name', 'member'),
    phone:    find('phone', 'mobile', 'tel', 'contact'),
    section:  find('section', 'group', 'voice', 'department', 'part'),
    status:   find('status', 'state'),
    birthday: find('birthday', 'dob', 'birth date', 'date of birth'),
  }
}

/** Returns true if the row looks like a header (more than half the cells are non-numeric text). */
function isHeaderRow(cells: string[]): boolean {
  const nonNumeric = cells.filter(c => c && !/^\d/.test(c)).length
  return nonNumeric >= Math.ceil(cells.length / 2)
}

function parseCsv(text: string): { rows: CsvRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { rows: [], skipped: 0 }

  const firstCells = splitCsvLine(lines[0])
  let colMap: Record<string, number> | null = null
  let startIdx = 0

  if (isHeaderRow(firstCells)) {
    colMap = detectColumns(firstCells)
    startIdx = 1
  }

  const rows: CsvRow[] = []
  let skipped = 0

  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])

    let name: string, phone: string | null, section: string | null, rawStatus: string, rawBirthday: string

    if (colMap && colMap.name !== -1) {
      // Header-guided mapping
      name        = (colMap.name    !== -1 ? cols[colMap.name]    : '')?.trim() ?? ''
      phone       = (colMap.phone   !== -1 ? cols[colMap.phone]   : null)?.trim() || null
      section     = (colMap.section !== -1 ? cols[colMap.section] : null)?.trim() || null
      rawStatus   = (colMap.status  !== -1 ? cols[colMap.status]  : '')?.trim().toLowerCase() ?? ''
      rawBirthday = (colMap.birthday !== -1 ? cols[colMap.birthday] : '')?.trim() ?? ''
    } else {
      // Positional fallback: Name, Phone, Section, Status, Birthday
      name        = cols[0]?.trim() ?? ''
      phone       = cols[1]?.trim() || null
      section     = cols[2]?.trim() || null
      rawStatus   = cols[3]?.trim().toLowerCase() ?? ''
      rawBirthday = cols[4]?.trim() ?? ''
    }

    if (!name) { skipped++; continue }

    rows.push({
      name,
      phone,
      section,
      status: rawStatus === 'inactive' ? 'inactive' : 'active',
      birthday: normaliseDate(rawBirthday),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBirthdayToday(birthday: string | null) {
  if (!birthday) return false
  const today = new Date()
  const bday = new Date(birthday)
  return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = ['#5247e6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({ member, canManage, onEdit, onDelete, onView }: {
  member: Member; canManage: boolean
  onEdit: (m: Member) => void; onDelete: (id: string) => void; onView: () => void
}) {
  const color = avatarColor(member.name)
  const isToday = isBirthdayToday(member.birthday)

  return (
    <div
      className="group flex items-center gap-3 sm:gap-4 px-4 py-4 cursor-pointer hover:bg-primary/[0.04] active:bg-primary/[0.07] transition-all duration-150 border-b border-border-dark last:border-0"
      onClick={onView}
    >
      {/* Avatar */}
      <div
        className="size-10 sm:size-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white relative"
        style={{ backgroundColor: `${color}25`, border: `1.5px solid ${color}40` }}
      >
        <span style={{ color }}>{getInitials(member.name)}</span>
        {isToday && (
          <span className="absolute -top-1 -right-1 text-[14px]">🎂</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-100 truncate">{member.name}</p>
          {member.status === 'inactive' && (
            <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">Retired</span>
          )}
          {isToday && (
            <span className="text-2xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 animate-pulse">🎂 Today</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {member.section && (
            <span className="text-2xs font-semibold text-primary/70">{member.section}</span>
          )}
          {member.section && member.phone && <span className="text-slate-700 text-2xs">·</span>}
          {member.phone && (
            <span className="text-2xs text-slate-500">{member.phone}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {canManage && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onEdit(member) }}
              className="size-10 flex items-center justify-center rounded-xl text-slate-600 hover:text-primary hover:bg-primary/10 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
              title="Edit"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(member.id) }}
              className="size-10 flex items-center justify-center rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
              title="Remove"
            >
              <span className="material-symbols-outlined text-[17px]">delete</span>
            </button>
          </>
        )}
        <span className="material-symbols-outlined text-slate-700 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all text-lg">chevron_right</span>
      </div>
    </div>
  )
}

// ─── Add/Edit Member Modal ────────────────────────────────────────────────────

const EMPTY: Omit<Member, 'id' | 'unit_id' | 'created_at'> = {
  name: '', phone: '', section: '', status: 'active', birthday: '',
}

function MemberFormModal({ editing, form, setForm, error, saving, onSubmit, onClose }: {
  editing: Member | null
  form: typeof EMPTY
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY>>
  error: string | null; saving: boolean
  onSubmit: (e: FormEvent) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mt-4 mb-1 sm:hidden" />
        <div className="sticky top-0 bg-surface-dark border-b border-border-dark/60 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100">{editing ? 'Edit Member' : 'Add Member'}</h3>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name *</span>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus
              placeholder="e.g. Johnathan Doe"
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all text-sm" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</span>
              <input type="tel" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+234 800 000 0000"
                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Section / Group</span>
              <input value={form.section ?? ''} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                placeholder="e.g. Soprano, Staff"
                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</span>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as MemberStatus }))}
                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all text-sm appearance-none cursor-pointer">
                <option value="active">Active</option>
                <option value="inactive">Retired / Inactive</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Birthday</span>
              <input type="date" value={form.birthday ?? ''} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
                className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all text-sm [color-scheme:dark]" />
            </label>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center gap-2">
              {saving && <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editing ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

function CsvImportModal({ csvRows, csvSkipped, csvFilename, importDone, importing, importError,
  onChooseFile, onImport, onClose, onDownloadTemplate,
}: {
  csvRows: CsvRow[]; csvSkipped: number; csvFilename: string
  importDone: number | null; importing: boolean; importError: string | null
  onChooseFile: () => void; onImport: () => void; onClose: () => void; onDownloadTemplate: () => void
}) {
  const exactCount = csvRows.filter(r => r.duplicateStatus === 'exact').length
  const fuzzyCount = csvRows.filter(r => r.duplicateStatus === 'fuzzy').length
  const importableCount = csvRows.filter(r => r.duplicateStatus !== 'exact').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mt-4 mb-1 sm:hidden" />

        {/* Header */}
        <div className="sticky top-0 bg-surface-dark border-b border-border-dark/60 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100">Import CSV</h3>
            {csvFilename && <p className="text-xs text-slate-500 mt-0.5">{csvFilename}</p>}
          </div>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5">
          {/* Success state */}
          {importDone !== null && (
            <div className="flex flex-col items-center gap-0 animate-in fade-in slide-in-from-bottom-8 duration-700 rounded-2xl overflow-hidden">
              <div className="w-full bg-background-dark border border-primary/20 rounded-2xl overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 size-24 bg-primary/10 rounded-full blur-3xl" />
                <div className="flex flex-col items-center gap-5 p-8 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
                    <div className="relative bg-primary text-white rounded-2xl p-4 shadow-[0_0_40px_rgba(82,71,230,0.5)] border border-white/20">
                      <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>group_add</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white text-2xl font-black tracking-tight">Transfer Complete!</h3>
                    <p className="text-slate-400 text-sm mt-1">Roster integration successful</p>
                  </div>
                </div>
                <div className="mx-6 mb-6 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-4">
                  <div className="bg-primary/10 p-2.5 rounded-xl text-primary border border-primary/20">
                    <span className="material-symbols-outlined text-xl">people</span>
                  </div>
                  <div>
                    <p className="text-slate-500 text-2xs uppercase tracking-spread font-bold">Members Integrated</p>
                    <p className="text-white font-black text-lg">{importDone} {importDone !== 1 ? 'Members' : 'Member'}</p>
                  </div>
                </div>
                <div className="px-6 pb-6">
                  <button onClick={onClose}
                    className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-3 group transition-all active:scale-95 text-sm">
                    View Roster
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No file chosen */}
          {importDone === null && !csvFilename && (
            <div className="flex flex-col items-center gap-6 py-8 text-center">
              <div className="size-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl">upload_file</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Upload Roster</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Select a CSV file to bulk-import members into this unit.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={onChooseFile}
                  className="w-full py-3 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30">
                  Choose File
                </button>
                <button onClick={onDownloadTemplate}
                  className="w-full py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-300 flex items-center justify-center gap-2 transition-colors rounded-xl hover:bg-border-dark">
                  <span className="material-symbols-outlined text-lg">download</span>
                  Download Template
                </button>
              </div>
              <details className="text-xs text-slate-600 w-full text-left">
                <summary className="cursor-pointer hover:text-slate-400 select-none">Expected CSV format</summary>
                <pre className="mt-2 rounded-lg bg-background-dark p-3 font-mono leading-relaxed text-slate-500 overflow-x-auto text-2xs">
                  {`Name,Phone,Section,Status,Birthday\nAlice Johnson,+2348001234567,Soprano,active,1990-05-14\nBob Smith,,Bass,active,1985-11-20`}
                </pre>
                <p className="mt-1 text-slate-600">Phone, Section, Status, and Birthday are optional. Status defaults to "active".</p>
              </details>
            </div>
          )}

          {/* Parse error */}
          {importDone === null && csvFilename && importError && !csvRows.length && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">{importError}</div>
          )}

          {/* Preview table */}
          {importDone === null && csvRows.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-500">
                {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} ready
                {csvSkipped > 0 && <span className="text-amber-500"> · {csvSkipped} skipped (empty name)</span>}
              </p>

              {exactCount > 0 && (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                  {exactCount} row(s) match existing members exactly and will be skipped.
                </p>
              )}
              {fuzzyCount > 0 && (
                <p className="text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                  {fuzzyCount} row(s) have names similar to existing members — please review.
                </p>
              )}

              <div className="overflow-x-auto rounded-xl border border-border-dark">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background-dark text-left text-2xs font-bold uppercase tracking-wider text-slate-500 border-b border-border-dark">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">Section</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Birthday</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark">
                    {csvRows.map((r, i) => (
                      <tr key={i} className={`whitespace-nowrap ${
                        r.duplicateStatus === 'exact' ? 'bg-red-500/10' :
                        r.duplicateStatus === 'fuzzy' ? 'bg-amber-500/10' : 'hover:bg-white/[0.02]'
                      }`}>
                        <td className="px-3 py-2.5 text-slate-200 font-medium">
                          {r.name}
                          {r.duplicateStatus === 'exact' && <span className="ml-2 rounded px-1.5 py-0.5 text-2xs font-bold uppercase bg-red-500/20 text-red-400">Duplicate</span>}
                          {r.duplicateStatus === 'fuzzy' && <span className="ml-2 rounded px-1.5 py-0.5 text-2xs font-bold uppercase bg-amber-500/20 text-amber-400">Similar</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{r.phone ?? '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500">{r.section ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-bold uppercase ${r.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{r.birthday ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importError && <p className="text-sm text-red-400">{importError}</p>}

              <div className="flex items-center justify-between gap-3">
                <button onClick={onChooseFile} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                  Choose different file
                </button>
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">
                    Cancel
                  </button>
                  <button onClick={onImport} disabled={importing || importableCount === 0}
                    className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-40 flex items-center gap-2">
                    {importing && <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Import {importableCount} member{importableCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Panel = 'none' | 'add' | 'import'

export default function UnitMembers() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isOwnerOrCreator, setIsOwnerOrCreator] = useState(false)
  const [unitName, setUnitName]   = useState('')
  const [orgName, setOrgName]     = useState('')
  const [members, setMembers]     = useState<Member[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)
  const [panel, setPanel]         = useState<Panel>('none')

  // Single-member form
  const [editing, setEditing]     = useState<Member | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // CSV import
  const [csvRows, setCsvRows]         = useState<CsvRow[]>([])
  const [csvSkipped, setCsvSkipped]   = useState(0)
  const [csvFilename, setCsvFilename] = useState('')
  const [importing, setImporting]     = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importDone, setImportDone]   = useState<number | null>(null)

  const PAGE_SIZE = 50

  const fetchMembers = useCallback(async (pageToFetch: number, isNewSearch = false) => {
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
        setMembers(data ?? []); setPage(0)
      } else {
        setMembers(prev => [...prev, ...(data ?? [])])
        setPage(pageToFetch)
      }
      setHasMore((data ?? []).length === PAGE_SIZE)
    } catch (err) {
      console.error('Failed to fetch members:', err)
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }, [unitId, search])

  useEffect(() => {
    if (!unitId) return
    supabase
      .from('units')
      .select('*, organization:organizations(name, organization_members(role, admin_id))')
      .eq('id', unitId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setUnitName(data.name)
          const org = data.organization as any
          setOrgName(org?.name ?? '')
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const mems = org?.organization_members as any[]
            const myMember = mems?.find(m => m.admin_id === user.id)
            const role = myMember?.role || 'member'
            const { data: isSuper } = await supabase.rpc('is_super_admin')
            setIsOwnerOrCreator(isSuper || role === 'owner' || data.created_by_admin_id === user.id)
          }
        }
      })
    fetchMembers(0, true)
  }, [unitId, fetchMembers])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { if (unitId) fetchMembers(0, true) }, 400)
    return () => clearTimeout(timer)
  }, [search, unitId, fetchMembers])

  const loadMore = () => { if (!loadingMore && hasMore) fetchMembers(page + 1) }

  // ── Form handlers ─────────────────────────────────────────────────────────

  function openCreate() { setEditing(null); setForm(EMPTY); setFormError(null); setPanel('add') }
  function openEdit(m: Member) {
    setEditing(m)
    setForm({ name: m.name, phone: m.phone ?? '', section: m.section ?? '', status: m.status, birthday: m.birthday ?? '' })
    setFormError(null); setPanel('add')
  }
  function closeForm() { setPanel('none'); setEditing(null); setFormError(null) }

  async function handleSave(e: FormEvent) {
    e.preventDefault(); setFormError(null); setSaving(true)
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
        const { data, error } = await supabase.from('members').insert({ ...payload, unit_id: unitId }).select().single()
        if (error) throw error
        setMembers(prev => [...prev, data].sort((a, b) =>
          (a.section ?? '').localeCompare(b.section ?? '') || a.name.localeCompare(b.name)
        ))
      }
      closeForm()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message
      setFormError(msg || 'Failed to save. Check your connection and try again.')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this member permanently?')) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) { alert(`Failed to remove member: ${error.message}`); return }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  // ── CSV import handlers ────────────────────────────────────────────────────

  function openImport() {
    setImportDone(null); setImportError(null); setCsvRows([]); setCsvFilename('')
    setPanel('import')
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
      const { data: allNames } = await supabase.from('members').select('name').eq('unit_id', unitId)
      const existingNames = (allNames ?? []).map(m => m.name)
      const annotated = rows.map(row => ({ ...row, duplicateStatus: detectDuplicate(row.name, existingNames) }))
      setCsvRows(annotated); setCsvSkipped(skipped)
      setImportError(annotated.length === 0 ? 'No valid rows found in this file.' : null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleImport() {
    if (!unitId || csvRows.length === 0) return
    setImporting(true); setImportError(null)
    try {
      const payload = csvRows.filter(r => r.duplicateStatus !== 'exact').map(r => ({
        unit_id: unitId, name: r.name, phone: r.phone, section: r.section, status: r.status, birthday: r.birthday,
      }))
      const { data, error } = await supabase.from('members').insert(payload).select()
      if (error) throw error
      const inserted = (data ?? []) as Member[]
      setMembers(prev => [...prev, ...inserted].sort((a, b) =>
        (a.section ?? '').localeCompare(b.section ?? '') || a.name.localeCompare(b.name)
      ))
      setImportDone(inserted.length); setCsvRows([])
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message
      setImportError(msg || 'Import failed. Check your connection and try again.')
    } finally { setImporting(false) }
  }

  // ── Grouped view ──────────────────────────────────────────────────────────

  const sections = [...new Set(members.map(m => m.section ?? ''))].sort((a, b) => {
    if (!a) return 1; if (!b) return -1; return a.localeCompare(b)
  })
  const grouped = sections.reduce<Record<string, Member[]>>((acc, s) => {
    acc[s] = members.filter(m => (m.section ?? '') === s)
    return acc
  }, {})

  const activeCount = members.filter(m => m.status === 'active').length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen w-full bg-background-dark text-slate-100 font-display antialiased">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-dark/90 backdrop-blur-md border-b border-border-dark/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between py-4">
            <button
              onClick={() => navigate(`/admin/units/${unitId}`)}
              className="size-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors"
            >
              <span className="material-symbols-outlined text-slate-100">arrow_back</span>
            </button>
            <div className="text-center">
              <h1 className="text-base font-bold text-slate-100 leading-tight">Unit Members</h1>
              {orgName && unitName && (
                <p className="text-2xs text-slate-500 uppercase tracking-widest mt-0.5">
                  {unitName} · {orgName}
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/help')}
              className="size-10 flex items-center justify-center rounded-full bg-surface-dark/50 border border-border-dark hover:bg-surface-dark transition-colors"
              title="User Guide"
            >
              <span className="material-symbols-outlined text-slate-400 hover:text-slate-100 transition-colors text-lg">help</span>
            </button>
          </div>

          {/* Search */}
          <div className="pb-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-xl pointer-events-none">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search members by name or section…"
                className="w-full bg-surface-dark border border-border-dark rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full hover:bg-border-dark transition-colors">
                  <span className="material-symbols-outlined text-slate-500 text-sm">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {isOwnerOrCreator && (
            <div className="flex gap-2.5 pb-3">
              <button
                onClick={openImport}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-dark border border-border-dark rounded-xl text-xs font-bold text-slate-300 hover:border-primary/40 hover:text-primary active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-lg">upload</span>
                Import CSV
              </button>
              <button
                onClick={openCreate}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary rounded-xl text-xs font-bold text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/30"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                Add Member
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-24">
        {loading ? (
          <div className="mt-4 space-y-3">
            <div className="h-4 w-36 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border-dark last:border-0">
                  <div className="size-10 rounded-full flex-shrink-0 animate-pulse bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
                    <div className="h-2.5 w-20 animate-pulse rounded-lg bg-white/[0.06]" />
                  </div>
                  <div className="h-5 w-14 rounded-full animate-pulse bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
        ) : members.length === 0 ? (
          <div className="bg-surface-dark rounded-2xl border border-dashed border-border-dark p-12 text-center mt-4">
            <span className="material-symbols-outlined text-5xl text-slate-700 block mb-3">group</span>
            <p className="font-bold text-slate-300 mb-1">{search ? 'No results' : 'No members yet'}</p>
            <p className="text-sm text-slate-500 mb-5">
              {search ? `No members match "${search}"` : 'Add your first member to get started.'}
            </p>
            {!search && isOwnerOrCreator && (
              <button onClick={openCreate}
                className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30">
                Add Member
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Section label */}
            <div className="py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">
                Current Members <span className="text-slate-500">({activeCount} active{members.length !== activeCount ? `, ${members.length - activeCount} retired` : ''})</span>
              </h2>
            </div>

            {/* Grouped members */}
            <div className="bg-surface-dark rounded-2xl border border-border-dark overflow-hidden">
              {sections.map((section, si) => (
                <div key={section}>
                  {section && (
                    <div className={`px-4 py-2.5 bg-background-dark/60 ${si > 0 ? 'border-t border-border-dark' : ''}`}>
                      <p className="text-2xs font-bold uppercase tracking-spaced text-primary/60">{section}</p>
                    </div>
                  )}
                  {grouped[section].map(member => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      canManage={isOwnerOrCreator}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onView={() => navigate(`/admin/units/${unitId}/members/${member.id}`)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-100 border border-border-dark hover:border-primary/40 hover:bg-primary/5 rounded-xl transition-all duration-150 flex items-center gap-2 disabled:opacity-40 active:scale-[0.97]"
                >
                  {loadingMore
                    ? <><span className="size-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /> Loading…</>
                    : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-surface-dark/95 backdrop-blur-xl border-t border-border-dark px-2 pt-2 pb-[env(safe-area-inset-bottom,1rem)]">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button onClick={() => navigate(`/admin/units/${unitId}`)} className="flex flex-col items-center gap-1 p-2 text-slate-500">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-2xs font-medium">Dashboard</span>
          </button>
          <button onClick={() => navigate(`/admin/units/${unitId}`)} className="flex flex-col items-center gap-1 p-2 text-slate-500">
            <span className="material-symbols-outlined">hub</span>
            <span className="text-2xs font-medium">Units</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            <span className="text-2xs font-bold">Members</span>
          </button>
          <button onClick={() => navigate(`/admin/units/${unitId}`)} className="flex flex-col items-center gap-1 p-2 text-slate-500">
            <span className="material-symbols-outlined">event</span>
            <span className="text-2xs font-medium">Events</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {panel === 'add' && (
        <MemberFormModal
          editing={editing} form={form} setForm={setForm}
          error={formError} saving={saving}
          onSubmit={handleSave} onClose={closeForm}
        />
      )}
      {panel === 'import' && (
        <CsvImportModal
          csvRows={csvRows} csvSkipped={csvSkipped} csvFilename={csvFilename}
          importDone={importDone} importing={importing} importError={importError}
          onChooseFile={() => fileInputRef.current?.click()}
          onImport={handleImport}
          onClose={() => setPanel('none')}
          onDownloadTemplate={downloadTemplate}
        />
      )}
    </div>
  )
}
