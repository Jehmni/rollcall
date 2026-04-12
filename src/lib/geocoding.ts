/**
 * geocoding.ts
 *
 * Wraps the Nominatim (OpenStreetMap) geocoding API with:
 *  - UK postcode detection and structured search
 *  - Structured query parameters for better precision
 *  - Per-result quality ranking
 *  - Honest fallback messaging
 *
 * Limitations (documented honestly):
 *  - Nominatim cannot enumerate every individual address within a postcode.
 *    For UK postcodes we return the postcode centroid; the admin can then
 *    drag the pin to the exact building using VenueMapPicker.
 *  - Building-level accuracy depends on what contributors have mapped in OSM.
 *    The map pin picker is the safety net for all cases where geocoding is only
 *    approximate.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchQuality =
  | 'exact'       // House number + street resolved
  | 'street'      // Street-level only
  | 'postcode'    // Postcode centroid
  | 'area'        // Neighbourhood / suburb / village
  | 'city'        // City/town level

// ── UI Helpers (Aesthetics & Labels) ──────────────────────────────────────────

export const QUALITY_COLOR: Record<MatchQuality, string> = {
  exact:    'text-emerald-400 bg-emerald-500/10',
  street:   'text-blue-400 bg-blue-500/10',
  postcode: 'text-amber-400 bg-amber-500/10',
  area:     'text-slate-400 bg-slate-500/10',
  city:     'text-slate-400 bg-slate-500/10',
}

export const QUALITY_LABEL: Record<MatchQuality, string> = {
  exact:    'Exact address',
  street:   'Street match',
  postcode: 'Postcode area',
  area:     'Area match',
  city:     'City / town',
}

export interface GeoResult {
  lat: string
  lon: string
  display_name: string
  type: string
  class: string
  importance: number
  address: {
    amenity?: string
    building?: string
    house_name?: string
    house_number?: string
    road?: string
    suburb?: string
    quarter?: string
    neighbourhood?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state_district?: string
    state?: string
    country?: string
    country_code?: string
    postcode?: string
  }
  quality: MatchQuality
  label: string    // Human-readable one-line summary
  sublabel: string // e.g. coords or match type note
}

// ── Postcode detection ────────────────────────────────────────────────────────

// UK: matches both full (BL8 1SZ) and outward-only (BL8) formats
const UK_POSTCODE_FULL = /^([A-Z]{1,2}[0-9][0-9A-Z]?)\s*([0-9][ABD-HJLNP-UW-Z]{2})$/i
const UK_POSTCODE_OUTWARD = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/i

function detectInputType(q: string): 'uk_postcode_full' | 'uk_postcode_outward' | 'text' {
  const t = q.trim()
  if (UK_POSTCODE_FULL.test(t)) return 'uk_postcode_full'
  if (UK_POSTCODE_OUTWARD.test(t)) return 'uk_postcode_outward'
  return 'text'
}

function normaliseUKPostcode(raw: string): string {
  // Insert space in the right place if missing: "BL81SZ" → "BL8 1SZ"
  const t = raw.trim().toUpperCase().replace(/\s+/g, '')
  const m = t.match(/^([A-Z]{1,2}[0-9][0-9A-Z]?)([0-9][ABD-HJLNP-UW-Z]{2})$/)
  return m ? `${m[1]} ${m[2]}` : t
}

// ── Quality assessment ────────────────────────────────────────────────────────

function assessQuality(r: Omit<GeoResult, 'quality' | 'label' | 'sublabel'>): MatchQuality {
  const a = r.address
  // 'exact' = building-level accuracy (either a house number, specific building name, or known amenity on a road)
  if ((a.house_number || a.building || a.house_name || a.amenity) && a.road) return 'exact'
  if (r.type === 'postcode' || (r.class === 'place' && r.type === 'postcode')) return 'postcode'
  if (a.road) return 'street'
  if (a.suburb || a.neighbourhood || a.quarter || a.village) return 'area'
  return 'city'
}

// Removed duplication here, using export from top of file.


// ── Label formatting ──────────────────────────────────────────────────────────

export function formatGeoResult(r: Pick<GeoResult, 'address' | 'display_name'>): string {
  const a = r.address
  const parts: string[] = []
  
  // Primary: House/Building/Landmark
  const building = a.amenity ?? a.building ?? a.house_name
  if (building) parts.push(building)
  if (a.house_number) parts.push(a.house_number)
  
  // Secondary: Street
  if (a.road) parts.push(a.road)
  
  // Tertiary: Local area
  const area = a.suburb ?? a.quarter ?? a.neighbourhood
  const city = a.city ?? a.town ?? a.village ?? a.municipality
  const region = a.county ?? a.state_district ?? a.state
  
  if (area && area !== city) parts.push(area)
  if (city) parts.push(city)
  if (region && region !== city) parts.push(region)
  if (a.country) parts.push(a.country)
  if (a.postcode) parts.push(a.postcode)
  
  return parts.length ? parts.join(', ') : r.display_name
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'Rollcally/1.0' }

async function rawSearch(params: Record<string, string>): Promise<GeoResult[]> {
  const p = new URLSearchParams({
    format: 'json',
    limit: '20',
    addressdetails: '1',
    ...params,
  })
  const res = await fetch(`${NOMINATIM_BASE}?${p}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`Geocoding service error: ${res.status}`)
  const data = await res.json() as Array<Record<string, unknown>>
  return data.map((r): GeoResult => {
    const base = r as Omit<GeoResult, 'quality' | 'label' | 'sublabel'>
    const quality = assessQuality(base)
    const label   = formatGeoResult(base)
    const sublabel = `${QUALITY_LABEL[quality]} · ${parseFloat(base.lat).toFixed(5)}, ${parseFloat(base.lon).toFixed(5)}`
    return { ...base, quality, label, sublabel }
  })
}

// Deduplicate by coordinate proximity (~11m grid)
function deduplicateResults(results: GeoResult[]): GeoResult[] {
  const seen = new Set<string>()
  return results.filter(r => {
    const key = `${parseFloat(r.lat).toFixed(4)},${parseFloat(r.lon).toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Fuzzy fallback ────────────────────────────────────────────────────────────

// Words that indicate what someone is looking for but aren't part of the address.
// Stripping them lets a query like "holiday inn in bolton" retry as "bolton".
const NON_GEO_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for',
  'in', 'at', 'by', 'on', 'near', 'around', 'with', 'from',
  'inn', 'hotel', 'motel', 'hostel', 'holiday', 'lodge',
  'pub', 'bar', 'restaurant', 'cafe', 'centre', 'center',
])

function stripNonGeoWords(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(w => !NON_GEO_WORDS.has(w.toLowerCase()))
    .join(' ')
}

// ── Main search entry point ───────────────────────────────────────────────────

/**
 * Smart search:
 * 1. Detects UK postcodes and uses the `postalcode` structured parameter.
 * 2. Falls back to free-text `q` for everything else.
 * 3. If no results, strips non-geographic words and retries (e.g. "holiday inn
 *    in bolton" → "bolton").
 * 4. Ranks results with exact matches first and surfaces honest quality notices.
 *
 * Returns results with quality labels so the UI can surface them honestly.
 */
export async function searchVenue(query: string): Promise<{
  results: GeoResult[]
  inputType: ReturnType<typeof detectInputType>
  notice: string | null
}> {
  const inputType = detectInputType(query.trim())
  let results: GeoResult[] = []
  let notice: string | null = null

  if (inputType === 'uk_postcode_full') {
    const postcode = normaliseUKPostcode(query)
    const rank: Record<MatchQuality, number> = { exact: 0, street: 1, postcode: 2, area: 3, city: 4 }
    const pcNorm = postcode.replace(/\s/g, '').toLowerCase()

    // Three-pronged search — fire all in parallel:
    // 1. Structured postalcode → always returns the centroid
    // 2. Free-text with the postcode → OSM objects tagged with this postcode
    // 3. Viewbox search around the centroid → named buildings/amenities in the area
    const [centroidResults, textResults] = await Promise.all([
      rawSearch({ postalcode: postcode, countrycode: 'gb' }),
      rawSearch({ q: postcode, countrycode: 'gb' }),
    ])

    let viewboxResults: GeoResult[] = []
    if (centroidResults.length > 0) {
      const cLat = parseFloat(centroidResults[0].lat)
      const cLon = parseFloat(centroidResults[0].lon)
      const d = 0.004  // ~400m — captures most UK postcode areas
      viewboxResults = await rawSearch({
        q: postcode,
        viewbox: `${cLon - d},${cLat + d},${cLon + d},${cLat - d}`,
        bounded: '1',
        countrycode: 'gb',
      })
      // Only keep results that actually belong to this postcode (not neighbours)
      viewboxResults = viewboxResults.filter(r =>
        r.address.postcode?.replace(/\s/g, '').toLowerCase() === pcNorm
      )
    }

    // Merge: named addresses first, centroid last
    const merged = deduplicateResults([...textResults, ...viewboxResults, ...centroidResults])
    results = merged.sort((a, b) => rank[a.quality] - rank[b.quality])

    const hasExactOrStreet = results.some(r => r.quality === 'exact' || r.quality === 'street')
    notice = hasExactOrStreet
      ? `Showing addresses found in ${postcode}. Select yours, then drag the pin to the exact spot if needed.`
      : `No individual addresses found for ${postcode} in the map data. Select the postcode area to open the map, then drag the pin to your exact building.`

  } else if (inputType === 'uk_postcode_outward') {
    results = await rawSearch({ postalcode: query.trim().toUpperCase(), countrycode: 'gb' })
    notice = 'Showing the general area for this postcode district. Try a full postcode (e.g. BL8 1SZ) to find specific addresses.'

  } else {
    // General text search
    const rank: Record<MatchQuality, number> = { exact: 0, street: 1, postcode: 2, area: 3, city: 4 }

    results = await rawSearch({ q: query.trim() })

    // ── Fuzzy retry ──────────────────────────────────────────────────────────
    // If nothing came back, strip non-geographic words and try again.
    // e.g. "holiday inn in bolton" → "bolton"
    if (results.length === 0) {
      const stripped = stripNonGeoWords(query)
      if (stripped && stripped !== query.trim()) {
        results = await rawSearch({ q: stripped })
        if (results.length > 0) {
          notice = `No results for "${query.trim()}". Showing results for "${stripped}" instead — select the closest match and drag the pin if needed.`
        }
      }
    }

    if (results.length > 0) {
      // Sort: exact first
      results = results.sort((a, b) => rank[a.quality] - rank[b.quality])

      const hasExactOrStreet = results.some(r => r.quality === 'exact' || r.quality === 'street')
      const hasCity = results.some(r => r.quality === 'city' || r.quality === 'area')

      if (!hasExactOrStreet) {
        if (hasCity && !notice) {
          // Only broad area results — query probably lacked a street/house number
          notice = 'Only area-level results found. Add a street name or house number for a more precise match.'
        } else if (!notice) {
          notice = 'Couldn\'t find that exact address. Select the closest match and use the map to pinpoint the location.'
        }
      } else if (hasExactOrStreet) {
        // Check if all street results are likely the wrong country/city
        // (no city in the query but we got street results — they could be anywhere)
        const queryLower = query.trim().toLowerCase()
        const hasLocationContext = results.some(r => {
          const city = (r.address.city ?? r.address.town ?? r.address.village ?? '').toLowerCase()
          const county = (r.address.county ?? r.address.state ?? '').toLowerCase()
          return (city && queryLower.includes(city)) || (county && queryLower.includes(county))
        })
        if (!hasLocationContext && !notice) {
          notice = 'These results match the street name but may be in the wrong city. Add a town or postcode — e.g. "Tottington Road, Bury" or "BL8".'
        }

        // Detect house-number miss: query contained a number but no result has that house_number
        const houseNumMatch = query.trim().match(/^\d+/)
        if (houseNumMatch) {
          const queriedNumber = houseNumMatch[0]
          const numberFound = results.some(r => r.address.house_number === queriedNumber)
          if (!numberFound && !notice) {
            notice = `House number ${queriedNumber} isn't mapped in OpenStreetMap. Select the closest section of the road, then drag the pin on the map to the exact building.`
          } else if (!numberFound) {
            notice += ` House number ${queriedNumber} isn't in the map data — drag the pin to the exact door after selecting a result.`
          }
        }
      }
    }
  }

  return { results, inputType, notice }
}
