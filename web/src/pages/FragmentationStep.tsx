import { useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import MetricCard, { type MetricCardVariant } from '../components/MetricCard'
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
  const [pins, setPins] = useState<Record<string, boolean>>({})

  const site: MetricSite =
    fragmentationSites.find((s) => s.id === siteId) ?? fragmentationSites[0]

  const valueOf = (metric: string) => site.metrics.find((x) => x.metric === metric)
  const togglePin = (key: string) => setPins((prev) => ({ ...prev, [key]: !prev[key] }))
  const pinnedCount = useMemo(() => Object.values(pins).filter(Boolean).length, [pins])

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Fragmentation"
      subtitle="landscape structure · screening · upstream TODO"
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {pinnedCount} pinned
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
          return (
            <MetricCard
              key={spec.key}
              variant={spec.variant}
              label={spec.label}
              value={fmt(metricRow.value)}
              unit={metricRow.unit}
              caption={spec.caption}
              pinned={!!pins[spec.key]}
              onTogglePin={() => togglePin(spec.key)}
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
