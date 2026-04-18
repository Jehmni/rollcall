/**
 * VenueMapPicker
 *
 * Full-screen map modal for admins to confirm or manually adjust the exact
 * location of a venue before saving it.
 *
 * Uses vanilla Leaflet directly (not react-leaflet) to avoid the
 * render2-is-not-a-function bundler conflict in react-leaflet v5 + Vite.
 */

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

// ── Custom SVG pin icon ───────────────────────────────────────────────────────

const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 10.438 14.25 26.5 15.293 27.674a1 1 0 0 0 1.414 0C17.75 42.5 32 26.438 32 16 32 7.163 24.837 0 16 0z" fill="#5247e6"/>
  <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
  <circle cx="16" cy="16" r="4" fill="#5247e6"/>
</svg>
`.trim()

const PIN_ICON = L.divIcon({
  html: PIN_SVG,
  className: '',
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
})

// ── Props ─────────────────────────────────────────────────────────────────────

export interface VenueMapPickerProps {
  initialLat: number
  initialLng: number
  /** Zoom level to open at. Pass 3 when no real coords exist (world overview). Default 16. */
  initialZoom?: number
  radiusMeters: number
  resolvedAddress?: string
  venueName?: string
  onConfirm: (lat: number, lng: number) => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VenueMapPicker({
  initialLat,
  initialLng,
  initialZoom = 16,
  radiusMeters,
  resolvedAddress,
  venueName,
  onConfirm,
  onCancel,
}: VenueMapPickerProps) {
  const [pinLat, setPinLat] = useState(initialLat)
  const [pinLng, setPinLng] = useState(initialLng)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef      = useRef<L.Map | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return   // guard against StrictMode double-fire

    const map = L.map(el, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    const circle = L.circle([initialLat, initialLng], {
      radius: radiusMeters,
      color: '#5247e6',
      fillColor: '#5247e6',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6 4',
    }).addTo(map)

    const marker = L.marker([initialLat, initialLng], {
      icon: PIN_ICON,
      draggable: true,
    }).addTo(map)

    const movePin = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng])
      circle.setLatLng([lat, lng])
      setPinLat(lat)
      setPinLng(lng)
    }

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      movePin(lat, lng)
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      movePin(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // run once on mount; props are captured by value in the closure

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background-dark">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-background-dark border-b border-border-dark z-10">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Search again
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirm Location</span>
        <div className="w-24" />
      </div>

      {/* ── Helper banner ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20">
        <span className="material-symbols-outlined text-primary text-base flex-shrink-0">touch_app</span>
        <p className="text-xs text-slate-300 leading-tight">
          <span className="font-bold text-white">Drag the pin</span> or tap the map to move it to the exact location of your venue.
        </p>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          style={{ height: '100%', width: '100%', background: '#1e293b' }}
        />
        <div className="absolute top-3 right-3 z-[400] pointer-events-none">
          <div className="bg-background-dark/80 backdrop-blur-sm rounded-none px-2.5 py-1.5 text-2xs text-slate-500 border border-border-dark text-center">
            Pinch to zoom
          </div>
        </div>
      </div>

      {/* ── Confirm panel ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 bg-background-dark border-t border-border-dark px-4 pt-4"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="size-10 flex-shrink-0 rounded-none bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">location_on</span>
          </div>
          <div className="flex-1 min-w-0">
            {venueName && (
              <p className="text-sm font-bold text-white truncate">{venueName}</p>
            )}
            {resolvedAddress && (
              <p className="text-2xs text-slate-400 leading-relaxed mt-0.5">{resolvedAddress}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="material-symbols-outlined text-slate-600 text-xs">my_location</span>
              <p className="text-2xs font-mono text-slate-500 tabular-nums">
                {pinLat.toFixed(6)}, {pinLng.toFixed(6)}
              </p>
              {radiusMeters > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <p className="text-2xs text-slate-500">{radiusMeters}m radius</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-none border border-border-dark text-slate-400 text-sm font-semibold hover:text-white hover:border-slate-600 active:scale-[0.98] transition-all"
          >
            Back
          </button>
          <button
            onClick={() => onConfirm(pinLat, pinLng)}
            className="flex-[2] py-3 bg-primary text-white text-sm font-black rounded-none shadow-lg shadow-primary/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            Use this location
          </button>
        </div>
      </div>
    </div>
  )
}


