import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import MetricCard, { type MetricCardVariant } from '../components/MetricCard'
import { usePins } from '../report/pins'
import { habitatLossSites } from '../samples/habitatLoss'
import type { HabitatLossSite } from '../types/contract'

interface CardSpec {
  key: string
  metric: string
  label: string
  variant?: MetricCardVariant
  /** Caption string, or a builder that takes the selected display year. */
  caption?: string | ((year: number) => string)
}

// Which metrics become cards, in order, with their look + a screening-grade note.
// Captions that carry a time reference take the selected year.
const CARD_SPECS: CardSpec[] = [
  { key: 'remaining', metric: 'habitat_remaining', label: 'Habitat remaining', variant: 'featured', caption: (y) => `suspected extent, ${y} (screening)` },
  { key: 'lost', metric: 'habitat_lost', label: 'Lost since 2000', caption: (y) => `class transition, 2000–${y}` },
  { key: 'rate', metric: 'loss_rate', label: 'Loss rate', variant: 'accent', caption: (y) => `2000–${y} mean (screening)` },
  { key: 'quarry', metric: 'quarry_footprint', label: 'Quarry footprint', caption: (y) => `registered extent, ${y} (sample)` },
  { key: 'core', metric: 'core_habitat', label: 'Core habitat', caption: (y) => `interior, ${y} (screening)` },
]

const DRIVERS = [
  { label: 'Mining', metric: 'driver_mining' },
  { label: 'Farming', metric: 'driver_farming' },
  { label: 'Other', metric: 'driver_other' },
]

const fmt = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString('en-US') : String(value)

/** Step 01 — Habitat loss. Loss metric cards for a selected site; pins are
 *  local to this step for D1 (H1 lifts them to a shared store). */
export default function HabitatLossStep() {
  const [siteId, setSiteId] = useState(habitatLossSites[0].id)
  const [year, setYear] = useState(() => habitatLossSites[0].metrics[0]?.year_end ?? 2026)
  const { isPinned, toggle, count } = usePins()

  const site: HabitatLossSite =
    habitatLossSites.find((s) => s.id === siteId) ?? habitatLossSites[0]

  // Available display years span the loss window (year_start…year_end), newest first.
  const yearStart = site.metrics[0]?.year_start ?? 2000
  const yearEnd = site.metrics[0]?.year_end ?? 2026
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearEnd - i)

  const valueOf = (metric: string) => site.metrics.find((x) => x.metric === metric)

  const drivers = DRIVERS.map((d) => ({ label: d.label, pct: valueOf(d.metric)?.value ?? 0 }))

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Habitat loss"
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <span>overall status ·</span>
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
          {habitatLossSites.map((s) => (
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
          const id = `habitat-loss:${site.id}:${spec.key}`
          const caption = typeof spec.caption === 'function' ? spec.caption(year) : spec.caption
          return (
            <MetricCard
              key={spec.key}
              variant={spec.variant}
              label={spec.label}
              value={fmt(metricRow.value)}
              unit={metricRow.unit}
              caption={caption}
              pinned={isPinned(id)}
              onTogglePin={() =>
                toggle({
                  id,
                  step: 'habitat-loss',
                  label: spec.label,
                  value: fmt(metricRow.value),
                  unit: metricRow.unit,
                  detail: site.name,
                })
              }
            />
          )
        })}

        <DriverBreakdown drivers={drivers} />
      </div>

      <p className="mt-4 text-xs text-secondary">
        Pinned figures carry into Step 05 · Report. Screening product — not confirmed loss.
      </p>
    </Sidebar>
  )
}

function DriverBreakdown({ drivers }: { drivers: { label: string; pct: number }[] }) {
  // Literal classes so Tailwind's scanner keeps them.
  const segColors = ['bg-navy', 'bg-teal', 'bg-navy-tint']
  return (
    <div className="rounded-card border border-brd bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Loss by driver</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-pill">
        {drivers.map((d, i) => (
          <div key={d.label} className={segColors[i % segColors.length]} style={{ width: `${d.pct}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-secondary">
        {drivers.map((d) => `${d.label.toLowerCase()} ${d.pct}%`).join(' · ')}
      </p>
    </div>
  )
}
