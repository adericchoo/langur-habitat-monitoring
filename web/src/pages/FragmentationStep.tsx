import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { MapYearContext } from '../App'
import Sidebar from '../components/Sidebar'
import MetricCard, { type MetricCardVariant } from '../components/MetricCard'
import { usePins } from '../report/pins'
import { fragmentationSites } from '../samples/fragmentation'
import type { MetricSite } from '../types/contract'

interface CardSpec {
  key: string
  metric: string
  label: string
  variant?: MetricCardVariant
  caption?: string
}

// Which fragmentation metrics become cards, in order, with their look + note.
const CARD_SPECS: CardSpec[] = [
  { key: 'mesh', metric: 'effective_mesh_size', label: 'Effective mesh size', variant: 'featured', caption: 'MESH — connectivity proxy (screening)' },
  { key: 'patches', metric: 'num_patches', label: 'Number of patches', caption: 'NP — distinct habitat fragments' },
  { key: 'lpi', metric: 'largest_patch_index', label: 'Largest patch index', variant: 'accent', caption: 'LPI — share in the biggest fragment' },
  { key: 'edge', metric: 'edge_density', label: 'Edge density', caption: 'ED — habitat/non-habitat boundary' },
  { key: 'core', metric: 'core_area', label: 'Core area', caption: 'interior, screening' },
]

const fmt = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString('en-US') : String(value)

/** Step 02 — Fragmentation. Patch/mesh metric cards for a selected site; pins
 *  are local to this step for E1 (H1 lifts them to a shared store). Corridors
 *  on the map are E2, not this step. Sample data — metrics are upstream TODO. */
export default function FragmentationStep() {
  const [siteId, setSiteId] = useState(fragmentationSites[0].id)
  // Year is shared with the map (via App's Outlet context), so this selector
  // also switches the satellite basemap to the nearest available year — the
  // same bar the Habitat loss step uses.
  const { mapYear: year, setMapYear: setYear } = useOutletContext<MapYearContext>()
  const { isPinned, toggle, count } = usePins()

  const site: MetricSite =
    fragmentationSites.find((s) => s.id === siteId) ?? fragmentationSites[0]

  // Available display years span the metric window (year_start…year_end), newest first.
  const yearStart = site.metrics[0]?.year_start ?? 2000
  const yearEnd = site.metrics[0]?.year_end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearEnd - i)

  const valueOf = (metric: string) => site.metrics.find((x) => x.metric === metric)

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Fragmentation"
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <span>Year displayed ·</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Display year"
            className="rounded-pill border border-brd bg-card px-2 py-0.5 text-sm font-semibold text-ink"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </span>
      }
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {count} pinned
        </span>
      }
    >
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary">
          Site
        </span>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm text-ink"
        >
          {fragmentationSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3">
        {CARD_SPECS.map((spec) => {
          const metricRow = valueOf(spec.metric)
          if (!metricRow) return null
          const id = `fragmentation:${site.id}:${spec.key}`
          return (
            <MetricCard
              key={spec.key}
              variant={spec.variant}
              label={spec.label}
              value={fmt(metricRow.value)}
              unit={metricRow.unit}
              caption={spec.caption}
              pinned={isPinned(id)}
              onTogglePin={() =>
                toggle({
                  id,
                  step: 'fragmentation',
                  label: spec.label,
                  value: fmt(metricRow.value),
                  unit: metricRow.unit,
                  detail: site.name,
                })
              }
            />
          )
        })}
      </div>

      <p className="mt-4 text-xs text-secondary">
        Pinned figures carry into Step 05 · Report. Sample metrics — fragmentation
        is not yet produced upstream.
      </p>
    </Sidebar>
  )
}
