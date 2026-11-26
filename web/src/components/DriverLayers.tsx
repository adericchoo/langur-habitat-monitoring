import { useMemo, useState } from 'react'
import type { FeatureCollection, Polygon } from 'geojson'
import { Layer, Source, Marker, Popup } from 'react-map-gl/maplibre'
import { driverFill, driverOutline } from '../map/layers'
import { DRIVER_FILL_OPACITY, MAP_TOKENS, type DriverKind } from '../map/mapTokens'
import type { ConfidenceLabel, DriverBlobProps, DriverFeature } from '../types/drivers'
import DriverCallout from './DriverCallout'

/**
 * Driver blobs on the map (Step 01 · Habitat loss). Hatched earth-tone fills
 * (auto-flagged look) via the shared driverFill/driverOutline builders + MAP_TOKENS
 * — no hardcoded hex. Auto-confidence modulates fill opacity; `verified` (always
 * false for now) is the seam for a future solid-fill state. Red stays reserved for
 * lost corridors — drivers are warm fills, distinct from corridor lines.
 *
 * `blobs` are already scoped to the active region, above the min-area highlight,
 * and limited to enabled drivers (MapStage). Labels + callouts are keyboard
 * accessible via focusable markers (polygons stay non-interactive).
 */
const DRIVER_NAME: Record<DriverKind, string> = { quarry: 'Quarry', agriculture: 'Agriculture' }

// Auto-confidence → fill-opacity factor (× the per-kind base). High reads boldest.
const CONF_FACTOR: Record<ConfidenceLabel, number> = { High: 1, Moderate: 0.78, Low: 0.55 }

// Quarries are OBJECTS (true rim + bright outline); agriculture is a clipped ZONE,
// drawn SOFTER + outline-less so its catchment-clip edge doesn't read as a boundary.
// Quarries draw on top of agriculture.
const KIND_SOFT: Record<DriverKind, number> = { quarry: 1, agriculture: 0.6 }
const KIND_ORDER: DriverKind[] = ['agriculture', 'quarry']

const fmt = (n: number) => n.toLocaleString('en-US')
const signed = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`
const labelFor = (p: DriverBlobProps) => `${DRIVER_NAME[p.driver]} · ${fmt(p.areaHa)} ha · ${signed(p.deltaHa)} ha`

function centroid(geom: Polygon): [number, number] {
  const pts = geom.coordinates[0].slice(0, -1) // drop the closing vertex
  const sum = pts.reduce((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0])
  return [sum[0] / pts.length, sum[1] / pts.length]
}

export default function DriverLayers({ blobs }: { blobs: DriverFeature[] }) {
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const activeId = pinnedId ?? hoverId
  const activeBlob = blobs.find((b) => b.properties.id === activeId)

  // One Source per driver kind present, each feature carrying a precomputed
  // `_opacity` (auto-confidence × base) that the fill reads per feature.
  const sources = useMemo(() => {
    const byKind = new Map<DriverKind, FeatureCollection<Polygon, DriverBlobProps & { _opacity: number }>>()
    for (const b of blobs) {
      const kind = b.properties.driver
      let fc = byKind.get(kind)
      if (!fc) {
        fc = { type: 'FeatureCollection', features: [] }
        byKind.set(kind, fc)
      }
      const _opacity = DRIVER_FILL_OPACITY[kind] * CONF_FACTOR[b.properties.confidence.label] * KIND_SOFT[kind]
      fc.features.push({ ...b, properties: { ...b.properties, _opacity } })
    }
    return byKind
  }, [blobs])

  return (
    <>
      {KIND_ORDER.filter((kind) => sources.has(kind)).map((kind) => (
        <Source key={kind} id={`drivers-${kind}`} type="geojson" data={sources.get(kind)!}>
          <Layer {...driverFill(kind, { opacity: ['get', '_opacity'] })} />
          {/* Quarry = object → crisp rim. Agriculture = soft zone → no outline. */}
          {kind === 'quarry' && <Layer {...driverOutline('quarry')} />}
        </Source>
      ))}

      {/* Focusable label markers — the keyboard/mouse handle for each blob. */}
      {blobs.map((b) => {
        const [lng, lat] = centroid(b.geometry)
        const p = b.properties
        const isActive = p.id === activeId
        return (
          <Marker key={p.id} longitude={lng} latitude={lat} anchor="center">
            <button
              type="button"
              aria-label={`${labelFor(p)} — ${p.confidence.label} confidence. Show details.`}
              aria-expanded={isActive}
              onClick={() => setPinnedId((cur) => (cur === p.id ? null : p.id))}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId((cur) => (cur === p.id ? null : cur))}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId((cur) => (cur === p.id ? null : cur))}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setPinnedId(null)
              }}
              className="cursor-pointer whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-semibold focus:outline-none focus-visible:ring-2"
              style={{
                color: MAP_TOKENS.label,
                background: 'rgba(11,18,33,0.72)',
                border: `1px solid ${isActive ? MAP_TOKENS.label : 'rgba(248,250,252,0.35)'}`,
                textShadow: `0 1px 2px ${MAP_TOKENS.labelHalo}`,
              }}
            >
              {labelFor(p)}
            </button>
          </Marker>
        )
      })}

      {activeBlob && (
        <Popup
          longitude={centroid(activeBlob.geometry)[0]}
          latitude={centroid(activeBlob.geometry)[1]}
          anchor="bottom"
          offset={14}
          closeButton={pinnedId === activeBlob.properties.id}
          closeOnClick={false}
          onClose={() => setPinnedId(null)}
          className="font-sans"
        >
          <DriverCallout blob={activeBlob.properties} />
        </Popup>
      )}
    </>
  )
}
