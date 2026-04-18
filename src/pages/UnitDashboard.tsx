import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useServices, useUnitAdmins, useUnits } from '../hooks/useAdminDashboard'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { ConfirmDialog } from '../components/ui/Modal'
import type { Service, Unit, OrgRole } from '../types'
import { NotificationBell } from '../components/NotificationBell'
import { searchVenue, formatGeoResult, QUALITY_COLOR, QUALITY_LABEL } from '../lib/geocoding'
import type { GeoResult } from '../lib/geocoding'
import { VenueMapPicker } from '../components/VenueMapPicker'


function serviceStatus(dateStr: string): 'today' | 'upcoming' | 'past' {
  const today = new Date().toISOString().split('T')[0]
  if (dateStr === today) return 'today'
  return dateStr > today ? 'upcoming' : 'past'
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Service card (dark style) ─────────────────────────────────────────────────
function ServiceCard({
  service, canManage, onClick, onEdit, onDelete,
}: {
  service: Service
  canManage: boolean
  onClick: () => void
  onEdit: (s: Service) => void
  onDelete: (s: Service) => void
}) {
  const status = serviceStatus(service.date)
  const isToday = status === 'today'
  const isPast  = status === 'past'

  const accentColor = isToday ? '#5247e6' : isPast ? '#475569' : '#10b981'
  const accentBg    = `${accentColor}1a`
  const statusLabel = { today: 'Active Today', upcoming: 'Scheduled', past: 'Archived' }[status]

  return (
    <div
      className={`group rounded-xl border transition-all duration-300 animate-in slide-in-from-bottom-2 overflow-hidden ${
        isPast
          ? 'bg-surface-dark border-border-dark opacity-60 hover:opacity-90'
          : 'bg-surface-dark border-border-dark hover:border-primary/40'
      }`}
    >
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ backgroundColor: isToday ? accentColor : 'transparent' }} />

      <div className="flex items-center gap-3 p-4 sm:p-5">
        {/* Icon */}
        <div
          className="size-12 sm:size-14 flex-shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300"
          style={{ backgroundColor: accentBg }}
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ color: accentColor }}>
            {isToday ? 'event_available' : isPast ? 'event' : 'calendar_month'}
          </span>
        </div>

        {/* Info — clickable */}
        <button
          onClick={onClick}
          className="flex-1 min-w-0 text-left group/nav"
        >
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm sm:text-base font-bold text-slate-100 tracking-tight group-hover/nav:text-primary transition-colors">
              {service.service_type}
            </p>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-black uppercase tracking-wider border"
              style={{ color: accentColor, borderColor: `${accentColor}40`, backgroundColor: accentBg }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-2xs font-semibold uppercase tracking-label text-slate-500">{formatDate(service.date)}</p>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {canManage && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(service) }}
                className="size-9 flex items-center justify-center rounded-xl text-slate-600 hover:text-primary hover:bg-primary/10 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                title="Edit event"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(service) }}
                className="size-9 flex items-center justify-center rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                title="Delete event"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </>
          )}
          <button
            onClick={onClick}
            className="size-9 flex items-center justify-center rounded-xl text-slate-600 group-hover:text-slate-400 transition-all"
          >
            <span className="material-symbols-outlined text-lg group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create / Edit Event Modal ─────────────────────────────────────────────────
function EventFormModal({
  editing, date, type, requireLocation, error, loading,
  venueMode, venueLat, venueLng, venueRadius, venueName, venueAddress,
  onChangeDate, onChangeType, onChangeRequireLocation,
  onChangeVenueMode, onChangeVenueLat, onChangeVenueLng,
  onChangeVenueRadius, onChangeVenueName, onChangeVenueAddress,
  onSubmit, onClose,
}: {
  editing: Service | null
  date: string; type: string; requireLocation: boolean; error: string | null; loading: boolean
  venueMode: 'unit_default' | 'override'
  venueLat: string; venueLng: string; venueRadius: string
  venueName: string; venueAddress: string
  onChangeDate: (v: string) => void
  onChangeType: (v: string) => void
  onChangeRequireLocation: (v: boolean) => void
  onChangeVenueMode: (v: 'unit_default' | 'override') => void
  onChangeVenueLat: (v: string) => void; onChangeVenueLng: (v: string) => void
  onChangeVenueRadius: (v: string) => void
  onChangeVenueName: (v: string) => void; onChangeVenueAddress: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}) {
  // Internal geocoding state for the meeting-level override search
  const [searchQuery, setSearchQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoNotice, setGeoNotice] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [confirmedIdx, setConfirmedIdx] = useState<number | null>(null)
  // VenueMapPicker state
  const [mapPicker, setMapPicker] = useState<{ lat: number; lng: number; address: string; name: string; zoom?: number } | null>(null)

  const overrideHasCoords = venueLat !== '' && venueLng !== ''
  const radiusNum = venueRadius !== '' ? parseInt(venueRadius, 10) : 100

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setGeoLoading(true); setGeoError(null); setGeoResults([]); setGeoNotice(null); setConfirmedIdx(null)
    try {
      const { results, notice } = await searchVenue(searchQuery)
      if (results.length === 0) {
        setGeoError('No matching locations found. Try adding more detail — e.g. city, postcode, or country.')
      } else {
        setGeoResults(results)
        setGeoNotice(notice)
      }
    } catch {
      setGeoError('Could not reach the location service. Please enter coordinates manually.')
    } finally {
      setGeoLoading(false)
    }
  }

  function selectResult(idx: number) {
    const r = geoResults[idx]
    const resolvedAddress = formatGeoResult(r)
    const suggestedName = venueName || (r.address.amenity ?? r.address.building ?? r.address.house_name ?? r.address.road ?? r.address.suburb ?? r.address.city ?? r.address.town ?? '')
    setMapPicker({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: resolvedAddress, name: suggestedName })
  }

  function handleMapConfirm(pinLat: number, pinLng: number) {
    if (!mapPicker) return
    onChangeVenueLat(pinLat.toFixed(6))
    onChangeVenueLng(pinLng.toFixed(6))
    onChangeVenueAddress(mapPicker.address)
    if (!venueName) onChangeVenueName(mapPicker.name)
    setConfirmedIdx(geoResults.findIndex(r => parseFloat(r.lat) === mapPicker.lat && parseFloat(r.lon) === mapPicker.lng))
    setMapPicker(null)
  }

  function openMapManually() {
    const hasCoords = venueLat !== '' && venueLng !== ''
    setMapPicker({
      lat: hasCoords ? parseFloat(venueLat) : 20,
      lng: hasCoords ? parseFloat(venueLng) : 0,
      address: venueAddress,
      name: venueName,
      zoom: hasCoords ? 16 : 3,
    })
  }

  // Show map picker as full-screen overlay when active
  if (mapPicker) {
    return (
      <VenueMapPicker
        initialLat={mapPicker.lat}
        initialLng={mapPicker.lng}
        initialZoom={mapPicker.zoom}
        radiusMeters={radiusNum}
        resolvedAddress={mapPicker.address}
        venueName={mapPicker.name}
        onConfirm={handleMapConfirm}
        onCancel={() => setMapPicker(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />

        <div className="flex items-center gap-4 mb-6">
          <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">
              {editing ? 'edit_calendar' : 'calendar_add_on'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{editing ? 'Edit Event' : 'Schedule Event'}</h3>
            <p className="text-xs text-slate-500">
              {editing ? 'Update the date or type for this session' : 'Initialise a formal session for attendance tracking'}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Date</span>
            <input
              type="date"
              value={date}
              onChange={e => onChangeDate(e.target.value)}
              required
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Type</span>
            <input
              type="text"
              value={type}
              onChange={e => onChangeType(e.target.value)}
              placeholder="e.g. Rehearsal, Sunday Service, Standup…"
              required
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </label>

          {/* Location toggle */}
          <button
            type="button"
            onClick={() => onChangeRequireLocation(!requireLocation)}
            className={`flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl border transition-all ${requireLocation ? 'bg-primary/10 border-primary/40' : 'bg-background-dark border-border-dark'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-xl ${requireLocation ? 'text-primary-light' : 'text-slate-500'}`}>
                {requireLocation ? 'location_on' : 'location_off'}
              </span>
              <div className="text-left">
                <p className={`text-sm font-semibold ${requireLocation ? 'text-slate-100' : 'text-slate-400'}`}>
                  {requireLocation ? 'In-person — Location required' : 'Online — No location check'}
                </p>
                <p className="text-2xs text-slate-500">
                  {requireLocation ? 'Members must be on-site to check in' : 'Members can check in from anywhere'}
                </p>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${requireLocation ? 'bg-primary' : 'bg-border-dark'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${requireLocation ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>

          {/* Meeting-level location override — only shown when location is required */}
          {requireLocation && (
            <div className="flex flex-col gap-3 rounded-xl bg-background-dark border border-border-dark p-4 animate-in fade-in duration-200">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Venue for this meeting</p>

              {/* Mode selector */}
              <div className="flex flex-col gap-2">
                {(['unit_default', 'override'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChangeVenueMode(mode)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      venueMode === mode
                        ? 'bg-primary/10 border-primary/40 text-white'
                        : 'bg-surface-dark border-border-dark text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className={`size-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      venueMode === mode ? 'border-primary' : 'border-slate-600'
                    }`}>
                      {venueMode === mode && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {mode === 'unit_default' ? 'Use unit default venue' : 'Set a different venue for this meeting'}
                      </p>
                      <p className="text-2xs text-slate-500">
                        {mode === 'unit_default'
                          ? 'The coordinates set in Unit Settings will be used'
                          : 'Override the venue just for this meeting'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Override form */}
              {venueMode === 'override' && (
                <div className="flex flex-col gap-3 pt-1 border-t border-border-dark animate-in fade-in duration-200">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Venue Name</span>
                    <input value={venueName} onChange={e => onChangeVenueName(e.target.value)}
                      placeholder="e.g. Town Hall — Main Room"
                      className="w-full bg-surface-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all" />
                  </label>

                  {/* Search */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                        placeholder="Search by address, postcode, area…"
                        className="w-full bg-surface-dark border border-border-dark rounded-xl pl-3 pr-9 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || geoLoading}
                      className="px-3 py-2 bg-primary/20 border border-primary/30 text-primary text-sm font-bold rounded-xl hover:bg-primary/30 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
                    >
                      {geoLoading ? '…' : 'Search'}
                    </button>
                  </div>
                  <p className="text-2xs text-slate-600 -mt-1">
                    e.g. "12 Example Street", "10 Demo Avenue, Test City" or "AB1 2CD"
                  </p>

                  {geoError && (
                    <p className="text-2xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">{geoError}</p>
                  )}

                  {/* Notice banner */}
                  {geoNotice && geoResults.length > 0 && confirmedIdx === null && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <span className="material-symbols-outlined text-amber-400 text-base flex-shrink-0 mt-0.5">info</span>
                      <p className="text-2xs text-amber-300 leading-relaxed">{geoNotice}</p>
                    </div>
                  )}

                  {geoResults.length > 0 && confirmedIdx === null && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                        Select the correct location
                      </p>
                      {geoResults.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectResult(i)}
                          className="text-left px-3 py-2.5 rounded-xl bg-surface-dark border border-border-dark hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-start gap-2 mb-0.5">
                            <p className="text-sm text-slate-100 font-medium leading-snug flex-1">{formatGeoResult(r)}</p>
                            <span className={`flex-shrink-0 text-2xs font-bold px-1.5 py-0.5 rounded-md ${QUALITY_COLOR[r.quality]}`}>
                              {QUALITY_LABEL[r.quality]}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-600">
                            {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Place on map / no results fallback */}
                  {confirmedIdx === null && geoResults.length === 0 && (
                    <button
                      type="button"
                      onClick={openMapManually}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-dark text-slate-400 hover:text-white hover:border-slate-600 text-sm transition-all active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-base">map</span>
                      Place on map manually
                    </button>
                  )}

                  {confirmedIdx !== null && (
                    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5 flex-shrink-0">check_circle</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-2xs text-emerald-300 font-semibold">Location confirmed</p>
                        <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">{venueAddress}</p>
                        <p className="text-2xs text-slate-600">{venueLat}, {venueLng}</p>
                      </div>
                      <button type="button" onClick={() => { setConfirmedIdx(null); setGeoResults([]) }}
                        className="text-slate-500 hover:text-slate-300 text-2xs underline underline-offset-2 flex-shrink-0">
                        Change
                      </button>
                    </div>
                  )}

                  {/* Manual coords fallback */}
                  {!overrideHasCoords && confirmedIdx === null && (
                    <details className="group">
                      <summary className="text-2xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors list-none flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform">chevron_right</span>
                        Enter coordinates manually
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Latitude</span>
                          <input value={venueLat} onChange={e => onChangeVenueLat(e.target.value)} placeholder="e.g. 51.5074"
                            className="w-full bg-surface-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 text-sm transition-all" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Longitude</span>
                          <input value={venueLng} onChange={e => onChangeVenueLng(e.target.value)} placeholder="e.g. -0.1278"
                            className="w-full bg-surface-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 text-sm transition-all" />
                        </label>
                      </div>
                    </details>
                  )}

                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Check-in radius (metres)</span>
                    <input value={venueRadius} onChange={e => onChangeVenueRadius(e.target.value)}
                      placeholder="100" type="number" min="10" max="5000"
                      className="w-full bg-surface-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 text-sm transition-all" />
                  </label>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center gap-2">
              {loading && <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save Changes' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// UI labels/colours moved to geocoding.ts for DRY reuse


// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  name, desc, lat, lng, radius, venueName, address,
  error, loading,
  onChangeName, onChangeDesc,
  onChangeLat, onChangeLng, onChangeRadius,
  onChangeVenueName, onChangeAddress,
  onSubmit, onDelete, onClose,
}: {
  name: string; desc: string
  lat: string; lng: string; radius: string
  venueName: string; address: string
  error: string | null; loading: boolean
  onChangeName: (v: string) => void; onChangeDesc: (v: string) => void
  onChangeLat: (v: string) => void; onChangeLng: (v: string) => void; onChangeRadius: (v: string) => void
  onChangeVenueName: (v: string) => void; onChangeAddress: (v: string) => void
  onSubmit: (e: FormEvent) => void; onDelete: () => void; onClose: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoNotice, setGeoNotice] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [confirmedIdx, setConfirmedIdx] = useState<number | null>(null)
  // VenueMapPicker state — holds the result being confirmed on the map
  const [mapPicker, setMapPicker] = useState<{ lat: number; lng: number; address: string; name: string; zoom?: number } | null>(null)

  const hasCoords = lat !== '' && lng !== ''
  const radiusNum = radius !== '' ? parseInt(radius, 10) : 100

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setGeoLoading(true); setGeoError(null); setGeoResults([]); setGeoNotice(null); setConfirmedIdx(null)
    try {
      const { results, notice } = await searchVenue(searchQuery)
      if (results.length === 0) {
        setGeoError('No matching locations found. Try adding more detail — e.g. city, postcode, or country.')
      } else {
        setGeoResults(results)
        setGeoNotice(notice)
      }
    } catch {
      setGeoError('Could not reach the location service. Please enter coordinates manually.')
    } finally {
      setGeoLoading(false)
    }
  }

  function selectResult(idx: number) {
    const r = geoResults[idx]
    const resolvedAddress = formatGeoResult(r)
    const suggestedName = venueName || (r.address.amenity ?? r.address.building ?? r.address.house_name ?? r.address.road ?? r.address.suburb ?? r.address.city ?? r.address.town ?? '')
    // Open map picker for precise pin placement
    setMapPicker({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: resolvedAddress, name: suggestedName })
  }

  function handleMapConfirm(pinLat: number, pinLng: number) {
    if (!mapPicker) return
    onChangeLat(pinLat.toFixed(6))
    onChangeLng(pinLng.toFixed(6))
    onChangeAddress(mapPicker.address)
    if (!venueName) onChangeVenueName(mapPicker.name)
    setConfirmedIdx(geoResults.findIndex(r => parseFloat(r.lat) === mapPicker.lat && parseFloat(r.lon) === mapPicker.lng))
    setMapPicker(null)
  }

  function openMapManually() {
    const hasExisting = lat !== '' && lng !== ''
    setMapPicker({
      lat: hasExisting ? parseFloat(lat) : 20,
      lng: hasExisting ? parseFloat(lng) : 0,
      address: address,
      name: venueName,
      zoom: hasExisting ? 16 : 3,
    })
  }

  // Show map picker as full-screen overlay when active
  if (mapPicker) {
    return (
      <VenueMapPicker
        initialLat={mapPicker.lat}
        initialLng={mapPicker.lng}
        initialZoom={mapPicker.zoom}
        radiusMeters={radiusNum}
        resolvedAddress={mapPicker.address}
        venueName={mapPicker.name}
        onConfirm={handleMapConfirm}
        onCancel={() => setMapPicker(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">settings</span>
            Unit Settings
          </h3>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unit Name</span>
            <input value={name} onChange={e => onChangeName(e.target.value)} required
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description <span className="normal-case font-normal text-slate-500">(optional)</span></span>
            <input value={desc} onChange={e => onChangeDesc(e.target.value)} placeholder="Purpose of this unit…"
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all" />
          </label>

          {/* ── Default Venue Location ─────────────────────────────────────── */}
          <div className="flex flex-col gap-3 pt-1 border-t border-border-dark">
            <div className="flex items-center gap-2 pt-3">
              <span className="material-symbols-outlined text-primary text-lg">location_on</span>
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Default Venue</span>
                <p className="text-2xs text-slate-500">Used for all meetings unless overridden per-event.</p>
              </div>
              {hasCoords && (
                <span className="ml-auto text-2xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Set</span>
              )}
            </div>

            {/* Venue name */}
            <label className="flex flex-col gap-1">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Venue Name</span>
              <input value={venueName} onChange={e => onChangeVenueName(e.target.value)}
                placeholder="e.g. St Andrew's Church Hall"
                className="w-full bg-background-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all" />
            </label>

            {/* Address search */}
            <div>
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Find Location</span>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                    placeholder="Search by address, postcode, area…"
                    className="w-full bg-background-dark border border-border-dark rounded-xl pl-4 pr-10 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || geoLoading}
                  className="px-4 py-2 bg-primary/20 border border-primary/30 text-primary text-sm font-bold rounded-xl hover:bg-primary/30 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
                >
                  {geoLoading ? '…' : 'Search'}
                </button>
              </div>
              <p className="text-2xs text-slate-600 mt-1.5">
                e.g. "12 Example Street", "10 Demo Avenue, Test City" or "AB1 2CD"
              </p>
            </div>

            {/* Geocode error */}
            {geoError && (
              <p className="text-2xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">{geoError}</p>
            )}

            {/* Notice banner (e.g. postcode centroid warning) */}
            {geoNotice && geoResults.length > 0 && confirmedIdx === null && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="material-symbols-outlined text-amber-400 text-base flex-shrink-0 mt-0.5">info</span>
                <p className="text-2xs text-amber-300 leading-relaxed">{geoNotice}</p>
              </div>
            )}

            {/* Results list — admin must pick explicitly */}
            {geoResults.length > 0 && confirmedIdx === null && (
              <div className="flex flex-col gap-1.5">
                <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                  {geoResults.length} result{geoResults.length > 1 ? 's' : ''} — select the correct location
                </p>
                {geoResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectResult(i)}
                    className="text-left px-3 py-2.5 rounded-xl bg-background-dark border border-border-dark hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-start gap-2 mb-0.5">
                      <p className="text-sm text-slate-100 font-medium leading-snug flex-1">{formatGeoResult(r)}</p>
                      <span className={`flex-shrink-0 text-2xs font-bold px-1.5 py-0.5 rounded-md ${QUALITY_COLOR[r.quality]}`}>
                        {QUALITY_LABEL[r.quality]}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-600">
                      {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Place on map / no results fallback */}
            {confirmedIdx === null && geoResults.length === 0 && (
              <button
                type="button"
                onClick={openMapManually}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-dark text-slate-400 hover:text-white hover:border-slate-600 text-sm transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base">map</span>
                Place on map manually
              </button>
            )}

            {/* Confirmed selection summary */}
            {confirmedIdx !== null && (
              <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5 flex-shrink-0">check_circle</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-emerald-300 font-semibold">Location confirmed</p>
                  <p className="text-2xs text-slate-400 mt-0.5 leading-relaxed">{address}</p>
                  <p className="text-2xs text-slate-600 mt-0.5">{lat}, {lng}</p>
                </div>
                <button type="button" onClick={() => { setConfirmedIdx(null); setGeoResults([]) }}
                  className="text-slate-500 hover:text-slate-300 text-2xs underline underline-offset-2 flex-shrink-0">
                  Change
                </button>
              </div>
            )}

            {/* Manual coordinate inputs (always available as fallback) */}
            <details className="group">
              <summary className="text-2xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors list-none flex items-center gap-1">
                <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform">chevron_right</span>
                Enter coordinates manually
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Latitude</span>
                    <input value={lat} onChange={e => onChangeLat(e.target.value)} placeholder="e.g. 51.5074"
                      className="w-full bg-background-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Longitude</span>
                    <input value={lng} onChange={e => onChangeLng(e.target.value)} placeholder="e.g. -0.1278"
                      className="w-full bg-background-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all" />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Stored Address</span>
                  <input value={address} onChange={e => onChangeAddress(e.target.value)}
                    placeholder="Full address (used for display)"
                    className="w-full bg-background-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all" />
                </label>
              </div>
            </details>

            <label className="flex flex-col gap-1">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Check-in radius (metres)</span>
              <input value={radius} onChange={e => onChangeRadius(e.target.value)} placeholder="100"
                type="number" min="10" max="5000"
                className="w-full bg-background-dark border border-border-dark rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all" />
              <p className="text-2xs text-slate-600 leading-relaxed">
                Members must be within this radius to check in when location enforcement is enabled.
              </p>
            </label>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onDelete} className="text-sm font-semibold text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors">
              <span className="material-symbols-outlined text-lg">delete</span> Delete Unit
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">Cancel</button>
              <button type="submit" disabled={loading}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50">
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Admins Panel Modal (super only) ──────────────────────────────────────────
function AdminsModal({
  admins, newEmail, error, loading,
  onChangeEmail, onSubmit, onRemove, onClose,
}: {
  admins: { id: string; user_id: string; email: string; created_at: string }[]; newEmail: string; error: string | null; loading: boolean
  onChangeEmail: (v: string) => void; onSubmit: (e: FormEvent) => void
  onRemove: (id: string) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[80vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">manage_accounts</span>
            Unit Admins
          </h3>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex gap-2 mb-5">
          <input
            type="email" value={newEmail} onChange={e => onChangeEmail(e.target.value)} placeholder="admin@email.com" required
            className="flex-1 bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all"
          />
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 flex-shrink-0">
            {loading ? '…' : 'Add'}
          </button>
        </form>
        {error && <p className="text-sm text-red-400 mb-4 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex flex-col gap-2">
          {admins.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No unit admins assigned yet.</p>
          ) : admins.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-xl px-4 py-3 bg-background-dark border border-border-dark">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">person</span>
                </div>
                <span className="text-sm font-medium text-slate-300 truncate">{a.email !== '—' ? a.email : a.user_id}</span>
              </div>
              <button onClick={() => onRemove(a.id)} className="p-2 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UnitDashboard() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const { isSuper, signOut, session } = useAuth()
  const { services, loading: servicesLoading, createService, updateService, deleteService } = useServices(unitId ?? null)
  const { updateUnit, deleteUnit } = useUnits(null)
  const { admins, addAdmin, removeAdmin } = useUnitAdmins(isSuper ? unitId ?? null : null)

  const [unit, setUnit] = useState<Unit | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAdmins, setShowAdmins]     = useState(false)
  const [userRole, setUserRole] = useState<OrgRole>('member')
  const [isOwnerOrCreator, setIsOwnerOrCreator] = useState(false)

  // Forms state — unit settings
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLat, setNewLat] = useState('')
  const [newLng, setNewLng] = useState('')
  const [newRadius, setNewRadius] = useState('100')
  const [newVenueName, setNewVenueName] = useState('')
  const [newAddress, setNewAddress] = useState('')

  // Forms state — event create/edit
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newType, setNewType] = useState('')
  const [newRequireLocation, setNewRequireLocation] = useState(false)
  const [svcVenueMode, setSvcVenueMode] = useState<'unit_default' | 'override'>('unit_default')
  const [svcVenueLat, setSvcVenueLat] = useState('')
  const [svcVenueLng, setSvcVenueLng] = useState('')
  const [svcVenueRadius, setSvcVenueRadius] = useState('100')
  const [svcVenueName, setSvcVenueName] = useState('')
  const [svcVenueAddress, setSvcVenueAddress] = useState('')

  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event edit/delete state
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [confirmDeleteService, setConfirmDeleteService] = useState<Service | null>(null)

  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin]     = useState(false)
  const [adminError, setAdminError]       = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!unitId || !session?.user?.id) return
    supabase
      .from('units')
      .select('*, organization:organizations(*, organization_members!inner(role))')
      .eq('id', unitId)
      .eq('organization.organization_members.admin_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUnit(data)
          const org = data.organization as { name: string; id: string; organization_members: { role: OrgRole }[] } | null
          setOrgName(org?.name ?? '')
          setOrgId(org?.id ?? '')
          setNewName(data.name)
          setNewDesc(data.description ?? '')
          setNewLat(data.latitude != null ? String(data.latitude) : '')
          setNewLng(data.longitude != null ? String(data.longitude) : '')
          setNewRadius(data.radius_meters != null ? String(data.radius_meters) : '100')
          setNewVenueName(data.venue_name ?? '')
          setNewAddress(data.address ?? '')
          const role = org?.organization_members?.[0]?.role || 'member'
          setUserRole(role)
          setIsOwnerOrCreator(isSuper || role === 'owner' || data.created_by_admin_id === session.user.id)
        }
      })
  }, [unitId, session?.user?.id, isSuper])

  function resetSvcVenue() {
    setSvcVenueMode('unit_default')
    setSvcVenueLat(''); setSvcVenueLng(''); setSvcVenueRadius('100')
    setSvcVenueName(''); setSvcVenueAddress('')
  }

  function openCreate() {
    setEditingService(null)
    setNewDate(new Date().toISOString().split('T')[0])
    setNewType('')
    setNewRequireLocation(false)
    resetSvcVenue()
    setError(null)
    setShowCreate(true)
  }

  function openEdit(svc: Service) {
    setEditingService(svc)
    setNewDate(svc.date)
    setNewType(svc.service_type)
    setNewRequireLocation(svc.require_location)
    // Populate venue override from service if present
    const hasOverride = svc.venue_lat != null && svc.venue_lng != null
    setSvcVenueMode(hasOverride ? 'override' : 'unit_default')
    setSvcVenueLat(svc.venue_lat != null ? String(svc.venue_lat) : '')
    setSvcVenueLng(svc.venue_lng != null ? String(svc.venue_lng) : '')
    setSvcVenueRadius(svc.venue_radius_meters != null ? String(svc.venue_radius_meters) : '100')
    setSvcVenueName(svc.venue_name ?? '')
    setSvcVenueAddress(svc.venue_address ?? '')
    setError(null)
    setShowCreate(true)
  }

  async function handleEventSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setIsUpdating(true)
    try {
      // Build venue override only when mode is 'override' and coordinates are provided
      const venueOverride = svcVenueMode === 'override' && svcVenueLat && svcVenueLng
        ? {
            venue_name: svcVenueName.trim() || null,
            venue_address: svcVenueAddress.trim() || null,
            venue_lat: parseFloat(svcVenueLat),
            venue_lng: parseFloat(svcVenueLng),
            venue_radius_meters: svcVenueRadius ? parseInt(svcVenueRadius, 10) : 100,
          }
        : undefined

      if (editingService) {
        await updateService(editingService.id, newDate, newType, newRequireLocation, venueOverride)
        setShowCreate(false); setEditingService(null)
      } else {
        const svc = await createService(newDate, newType, newRequireLocation, venueOverride)
        setShowCreate(false)
        navigate(`/admin/units/${unitId}/events/${svc.id}`)
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? String(err)
      setError(msg.includes('unique') ? 'An event already exists for that date and type.' : msg)
    } finally { setIsUpdating(false) }
  }

  async function handleDeleteService() {
    if (!confirmDeleteService) return
    setIsUpdating(true)
    try {
      await deleteService(confirmDeleteService.id)
      setConfirmDeleteService(null)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to delete event'
      setError(msg)
    } finally { setIsUpdating(false) }
  }

  async function handleUpdateUnit(e: FormEvent) {
    e.preventDefault(); if (!unitId) return; setError(null); setIsUpdating(true)
    try {
      const parsedLat = newLat !== '' ? parseFloat(newLat) : null
      const parsedLng = newLng !== '' ? parseFloat(newLng) : null
      const parsedRadius = newRadius !== '' ? parseInt(newRadius, 10) : null
      const updated = await updateUnit(
        unitId,
        newName.trim(),
        newDesc.trim() || undefined,
        {
          latitude: parsedLat,
          longitude: parsedLng,
          radius_meters: parsedRadius,
          venue_name: newVenueName.trim() || null,
          address: newAddress.trim() || null,
        },
      )
      setUnit(updated); setShowSettings(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update unit') }
    finally { setIsUpdating(false) }
  }

  async function handleDeleteUnit() {
    if (!unitId || !unit) return; setIsUpdating(true)
    try {
      await deleteUnit(unitId)
      navigate(isSuper ? `/admin/orgs/${unit.org_id}` : '/admin', { replace: true })
    } catch { setError('Failed to delete unit'); setIsUpdating(false) }
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault(); setAdminError(null); setAddingAdmin(true)
    try { await addAdmin(newAdminEmail.trim().toLowerCase()); setNewAdminEmail('') }
    catch (err) { setAdminError(err instanceof Error ? err.message : 'Failed to add admin') }
    finally { setAddingAdmin(false) }
  }

  const today    = new Date().toISOString().split('T')[0]
  const upcoming = services.filter(s => s.date >= today)
  const past     = services.filter(s => s.date < today)

  const totalSessions = services.length
  const todaySessions = services.filter(s => s.date === today).length

  const roleLabel = userRole === 'owner' ? 'Org Owner' : isOwnerOrCreator ? 'Command' : 'Observer'
  const roleBadgeColor = userRole === 'owner' ? '#5247e6' : isOwnerOrCreator ? '#10b981' : '#64748b'

  return (
    <div className="relative min-h-screen w-full bg-background-dark text-slate-100 font-display antialiased overflow-x-hidden">

      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden pb-8">
        {/* Background glows */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 -mt-16 -mr-16 size-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-8 size-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between pt-4 pb-6 sm:pt-6">
            <button
              onClick={() => navigate(isSuper && orgId ? `/admin/orgs/${orgId}` : '/admin')}
              className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-white">arrow_back</span>
            </button>

            <span className="text-xs font-bold uppercase tracking-widest text-white/60">Rollcally</span>

            <div className="flex items-center gap-2">
              {unitId && <NotificationBell unitId={unitId} />}
              <ThemeToggle className="bg-white/10 hover:bg-white/20 border border-white/10 dark:bg-white/10 dark:hover:bg-white/20" />
              <button
                onClick={() => navigate('/help')}
                className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                title="User Guide"
              >
                <span className="material-symbols-outlined text-white text-xl">help</span>
              </button>
              <button
                onClick={() => signOut()}
                className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-white text-xl">logout</span>
              </button>
            </div>
          </div>

          {/* Unit identity */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="size-20 sm:size-24 bg-primary/20 border-2 border-primary/40 rounded-3xl flex items-center justify-center mb-4 shadow-2xl shadow-primary/30">
              <span className="material-symbols-outlined text-primary text-4xl sm:text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">{unit?.name ?? 'Unit'}</h1>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {orgName && <span className="text-xs font-medium text-white/60 uppercase tracking-wider">{orgName}</span>}
              {orgName && <span className="text-white/40">·</span>}
              <span
                className="text-2xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
                style={{ color: roleBadgeColor, borderColor: `${roleBadgeColor}40`, backgroundColor: `${roleBadgeColor}15` }}
              >
                {roleLabel}
              </span>
            </div>
            {unit?.description && (
              <p className="text-sm text-white/65 mt-2 max-w-xs">{unit.description}</p>
            )}
          </div>

          {/* Quick stat pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-white">{servicesLoading ? '–' : upcoming.length}</p>
              <p className="text-2xs font-bold uppercase tracking-wider text-white/65 mt-0.5">Upcoming</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-white">{servicesLoading ? '–' : totalSessions}</p>
              <p className="text-2xs font-bold uppercase tracking-wider text-white/65 mt-0.5">Total</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center">
              <p className={`text-xl sm:text-2xl font-extrabold ${todaySessions > 0 ? 'text-emerald-300' : 'text-white'}`}>
                {servicesLoading ? '–' : todaySessions > 0 ? 'Live' : '—'}
              </p>
              <p className="text-2xs font-bold uppercase tracking-wider text-white/65 mt-0.5">Today</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Action Bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background-dark/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
          {/* Members — always visible */}
          <button
            onClick={() => navigate(`/admin/units/${unitId}/members`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 flex-1 sm:flex-none justify-center sm:justify-start"
          >
            <span className="material-symbols-outlined text-sm">group</span>
            Members
          </button>

          {/* Create Event */}
          {isOwnerOrCreator && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-dark border border-border-dark text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl hover:border-primary/50 hover:text-primary active:scale-95 transition-all flex-1 sm:flex-none justify-center sm:justify-start"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Event
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">

            {/* Settings */}
            {isOwnerOrCreator && (
              <button
                onClick={() => setShowSettings(true)}
                className="size-11 flex items-center justify-center rounded-xl bg-surface-dark border border-border-dark text-slate-500 hover:text-primary hover:border-primary/40 active:scale-95 transition-all"
                title="Unit Settings"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
              </button>
            )}

            {/* Manage Admins (super only) */}
            {isSuper && (
              <button
                onClick={() => setShowAdmins(true)}
                className="size-11 flex items-center justify-center rounded-xl bg-surface-dark border border-border-dark text-slate-500 hover:text-primary hover:border-primary/40 active:scale-95 transition-all"
                title="Manage Admins"
              >
                <span className="material-symbols-outlined text-lg">manage_accounts</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20">

        {/* Loading — skeleton cards */}
        {servicesLoading && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-dark border border-border-dark p-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl flex-shrink-0 animate-pulse bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-24 animate-pulse rounded-md bg-white/[0.06]" />
                    <div className="h-2.5 w-36 animate-pulse rounded-md bg-white/[0.06]" />
                  </div>
                  <div className="h-5 w-14 rounded-full animate-pulse bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!servicesLoading && services.length === 0 && (
          <div className="bg-surface-dark rounded-2xl border border-dashed border-border-dark p-12 text-center animate-in fade-in duration-300">
            <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-4xl text-primary">calendar_month</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">No Events Yet</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mb-7">
              The calendar is clear. Create your first event to generate a check-in QR code and track attendance.
            </p>
            {isOwnerOrCreator && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30"
              >
                Schedule First Event
              </button>
            )}
          </div>
        )}

        {/* Upcoming events */}
        {!servicesLoading && upcoming.length > 0 && (
          <section className="mb-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-slate-100">Upcoming Sessions</h2>
              <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-2xs font-black uppercase tracking-wider">
                {upcoming.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  canManage={isOwnerOrCreator}
                  onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)}
                  onEdit={openEdit}
                  onDelete={setConfirmDeleteService}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past sessions */}
        {!servicesLoading && past.length > 0 && (
          <section className="animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-slate-400">Past Sessions</h2>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-full text-2xs font-black uppercase tracking-wider">
                {past.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-70">
              {past.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  canManage={isOwnerOrCreator}
                  onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)}
                  onEdit={openEdit}
                  onDelete={setConfirmDeleteService}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showCreate && (
        <EventFormModal
          editing={editingService}
          date={newDate} type={newType} requireLocation={newRequireLocation} error={error} loading={isUpdating}
          venueMode={svcVenueMode}
          venueLat={svcVenueLat} venueLng={svcVenueLng} venueRadius={svcVenueRadius}
          venueName={svcVenueName} venueAddress={svcVenueAddress}
          onChangeDate={setNewDate} onChangeType={setNewType} onChangeRequireLocation={setNewRequireLocation}
          onChangeVenueMode={setSvcVenueMode}
          onChangeVenueLat={setSvcVenueLat} onChangeVenueLng={setSvcVenueLng}
          onChangeVenueRadius={setSvcVenueRadius}
          onChangeVenueName={setSvcVenueName} onChangeVenueAddress={setSvcVenueAddress}
          onSubmit={handleEventSubmit}
          onClose={() => { setShowCreate(false); setEditingService(null); setError(null) }}
        />
      )}
      <ConfirmDialog
        isOpen={!!confirmDeleteService}
        onClose={() => setConfirmDeleteService(null)}
        onConfirm={handleDeleteService}
        title="Delete Event"
        description={confirmDeleteService ? `Delete the ${confirmDeleteService.service_type} on ${formatDate(confirmDeleteService.date)}? All attendance records for this event will be permanently removed.` : ''}
        confirmText="Delete Event"
        variant="danger"
        isLoading={isUpdating}
      />
      {showSettings && (
        <SettingsModal
          name={newName} desc={newDesc}
          lat={newLat} lng={newLng} radius={newRadius}
          venueName={newVenueName} address={newAddress}
          error={error} loading={isUpdating}
          onChangeName={setNewName} onChangeDesc={setNewDesc}
          onChangeLat={setNewLat} onChangeLng={setNewLng} onChangeRadius={setNewRadius}
          onChangeVenueName={setNewVenueName} onChangeAddress={setNewAddress}
          onSubmit={handleUpdateUnit}
          onDelete={() => { setShowSettings(false); setConfirmDelete(true) }}
          onClose={() => { setShowSettings(false); setError(null) }}
        />
      )}
      {isSuper && showAdmins && (
        <AdminsModal
          admins={admins} newEmail={newAdminEmail} error={adminError} loading={addingAdmin}
          onChangeEmail={setNewAdminEmail}
          onSubmit={handleAddAdmin}
          onRemove={removeAdmin}
          onClose={() => { setShowAdmins(false); setAdminError(null) }}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteUnit}
        title="Delete Unit"
        description={`Are you sure you want to delete "${unit?.name}"? All events and attendance data will be permanently removed.`}
        confirmText="Delete Unit"
        variant="danger"
        isLoading={isUpdating}
      />
    </div>
  )
}
