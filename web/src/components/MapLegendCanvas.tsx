import { useState } from 'react'
import { MAP_TOKENS } from '../map/mapTokens'

/**
 * Map-canvas legend — reads MAP_TOKENS (the same source of truth the layer paint
 * uses), so swatches can never drift from the map. Laid out as side-by-side
 * COLUMNS, one per category; each row's swatch FORM matches the geometry
 * (line / dash / fill / hatch), reinforcing "hue = category, form = geometry".
 *
 * Dark panel: the map is dark imagery and several tokens are near-white (active
 * region, selected), which would vanish on a white card — so the legend carries
 * its own dark background + light text, independent of the chrome tokens.
 *
 * `active` is the set of fine-grained keys for the layers currently on; a column
 * shows only its active rows (and hides entirely when it has none), so the legend
 * stays accurate even in production where most layers don't render.
 */
type Form = 'fill' | 'line' | 'dash' | 'hatch'
interface LegendRow {
  /** Which toggle gates this row (matches the keys MapStage passes in `active`). */
  on: string
  label: string
  color: string
  form: Form
}
interface LegendColumn {
  key: string
  title: string
  rows: LegendRow[]
}

const COLUMNS: LegendColumn[] = [
  {
    key: 'regions',
    title: 'Regions',
    rows: [
      { on: 'regions', label: 'Region', color: MAP_TOKENS.region, form: 'line' },
      { on: 'regions', label: 'Active region', color: MAP_TOKENS.regionActive, form: 'line' },
    ],
  },
  {
    key: 'areas',
    title: 'Areas',
    rows: [
      { on: 'pa', label: 'Protected area', color: MAP_TOKENS.protected, form: 'dash' },
      { on: 'habitat', label: 'Habitat patch', color: MAP_TOKENS.habitatFill, form: 'fill' },
    ],
  },
  {
    key: 'corridors',
    title: 'Corridors',
    rows: [
      { on: 'corridors', label: 'Intact', color: MAP_TOKENS.corridorIntact, form: 'line' },
      { on: 'corridors', label: 'Partial', color: MAP_TOKENS.corridorPartial, form: 'line' },
      { on: 'corridors', label: 'Lost', color: MAP_TOKENS.corridorLost, form: 'line' },
    ],
  },
  {
    key: 'drivers',
    title: 'Drivers · screening',
    rows: [
      { on: 'drivers', label: 'Quarry', color: MAP_TOKENS.quarry, form: 'hatch' },
      { on: 'drivers', label: 'Agriculture', color: MAP_TOKENS.agriculture, form: 'hatch' },
    ],
  },
  {
    key: 'alert',
    title: 'Alerts',
    rows: [{ on: 'alert', label: 'Auto-detected (screening)', color: MAP_TOKENS.alert, form: 'fill' }],
  },
]

function Swatch({ color, form }: { color: string; form: Form }) {
  if (form === 'fill') {
    return <span className="h-2 w-3 shrink-0 rounded-[2px]" style={{ backgroundColor: color, opacity: 0.75 }} aria-hidden />
  }
  if (form === 'hatch') {
    return (
      <span
        className="h-2 w-3 shrink-0 rounded-[2px]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 1px, transparent 1px 3px)`,
          border: `1px solid ${color}`,
        }}
        aria-hidden
      />
    )
  }
  if (form === 'dash') {
    return <span className="w-3.5 shrink-0" style={{ borderTop: `2px dashed ${color}` }} aria-hidden />
  }
  return <span className="h-[3px] w-3.5 shrink-0 rounded-pill" style={{ backgroundColor: color }} aria-hidden />
}

export default function MapLegendCanvas({ active }: { active: string[] }) {
  const [open, setOpen] = useState(false)
  const set = new Set(active)
  const cols = COLUMNS.map((c) => ({ ...c, rows: c.rows.filter((r) => set.has(r.on)) })).filter(
    (c) => c.rows.length > 0,
  )
  if (cols.length === 0) return null
  return (
    <div
      className="group rounded-card px-2.5 py-1.5 font-sans shadow-sm"
      style={{ backgroundColor: 'rgba(11,18,33,0.9)', border: '1px solid rgba(248,250,252,0.15)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="block cursor-pointer text-[9px] font-semibold uppercase tracking-wide"
        style={{ color: MAP_TOKENS.region }}
      >
        Legend
      </button>
      {/* Collapsed to just the "Legend" label until hovered, focused, or clicked. */}
      <div
        className={`mt-1 max-w-[calc(100vw-1.5rem)] flex-wrap items-start gap-x-4 gap-y-2 group-hover:flex group-focus-within:flex ${open ? 'flex' : 'hidden'}`}
      >
        {cols.map((c) => (
          <div key={c.key} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: MAP_TOKENS.region }}>
              {c.title}
            </span>
            {c.rows.map((r) => (
              <span key={r.label} className="inline-flex items-center gap-1 text-[10px] leading-tight" style={{ color: MAP_TOKENS.label }}>
                <Swatch color={r.color} form={r.form} />
                {r.label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
