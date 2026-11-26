import { MAP_TOKENS } from '../map/mapTokens'

/**
 * Step Zero on-map control (top-right): a functional basemap-opacity slider plus a
 * small legend (region boundary / protected area). Dark card over the imagery — it
 * reads MAP_TOKENS (the same source of truth as the layer paint) so the swatches
 * can never drift from the map, matching the MapLegendCanvas idiom.
 */
export interface BasemapOpacityControlProps {
  /** 0–1 basemap opacity. */
  opacity: number
  onOpacity: (value: number) => void
}

export default function BasemapOpacityControl({ opacity, onOpacity }: BasemapOpacityControlProps) {
  const pct = Math.round(opacity * 100)
  return (
    <div
      className="w-56 rounded-card px-3 py-2.5 font-sans shadow-sm"
      style={{ backgroundColor: 'rgba(11,18,33,0.9)', border: '1px solid rgba(248,250,252,0.15)' }}
    >
      <label className="block">
        <span
          className="mb-1.5 block text-[9px] font-semibold uppercase tracking-wide"
          style={{ color: MAP_TOKENS.region }}
        >
          Basemap opacity
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onOpacity(Number(e.target.value) / 100)}
          aria-label="Basemap opacity"
          aria-valuetext={`${pct}%`}
          className="w-full accent-teal"
        />
      </label>

      {/* Legend — region boundary (solid) / protected area (dashed). */}
      <div className="mt-2.5 space-y-1 border-t pt-2" style={{ borderColor: 'rgba(248,250,252,0.12)' }}>
        <LegendRow color={MAP_TOKENS.region} dashed={false} label="region boundary" />
        <LegendRow color={MAP_TOKENS.protected} dashed label="protected area" />
      </div>
    </div>
  )
}

function LegendRow({ color, dashed, label }: { color: string; dashed: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[10px] leading-tight" style={{ color: MAP_TOKENS.label }}>
      <span
        className="w-4 shrink-0"
        style={dashed ? { borderTop: `2px dashed ${color}` } : { borderTop: `2px solid ${color}` }}
        aria-hidden
      />
      {label}
    </span>
  )
}
