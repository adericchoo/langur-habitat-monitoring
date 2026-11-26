import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { MapYearContext } from '../App'
import Sidebar from '../components/Sidebar'
import MetricCard, { type MetricCardVariant } from '../components/MetricCard'
import { usePins } from '../report/pins'
import { useMetricSites } from '../report/metrics'
import { habitatLossSites } from '../samples/habitatLoss'
import type { MetricSite } from '../types/contract'
import { useCompare } from '../compare/CompareContext'
import CompareDashboard from '../compare/CompareDashboard'
import LayerSection, { type HabitatLayer } from '../components/LayerSection'

interface CardSpec {
  key: string
  metric: string
  /** Label + caption take the layer noun ('Habitat' | 'Forest') so the same spec
   *  renders both tracks; the time window comes from the data (year_start…year). */
  label: (noun: string) => string
  variant?: MetricCardVariant
  caption?: (noun: string, year: number, yearStart: number) => string
}

// Which metrics become cards, in order, with their look + a screening-grade note.
// `noun` is the layer ('Habitat' or 'Forest'); the window is read from the data so
// captions show the real epoch span (2017–…), not a hard-coded baseline.
const CARD_SPECS: CardSpec[] = [
  { key: 'remaining', metric: 'habitat_remaining', label: (n) => `${n} area remaining`, variant: 'featured', caption: (_n, y) => `suspected extent, ${y} (screening)` },
  { key: 'lost', metric: 'habitat_lost', label: (n) => `${n} cleared`, caption: (_n, y, ys) => `class transition, ${ys}–${y}` },
  { key: 'gain', metric: 'forest_gain', label: (n) => `${n} regained`, caption: (n) => `non-${n.toLowerCase()} → ${n.toLowerCase()} (screening)` },
  { key: 'rate', metric: 'loss_rate', label: () => 'Annual loss rate', variant: 'accent', caption: (_n, y, ys) => `${ys}–${y} mean (screening)` },
  { key: 'quarry', metric: 'quarry_footprint', label: () => 'Quarry footprint', caption: (_n, y) => `registered extent, ${y} (screening)` },
]

const DRIVERS = [
  { label: 'Mining', metric: 'driver_mining' },
  { label: 'Farming', metric: 'driver_farming' },
  { label: 'Other', metric: 'driver_other' },
]

const fmt = (value: number) =>
  Number.isInteger(value) ? value.toLocaleString('en-US') : String(value)

/** Step 01 — Habitat loss. Two real pipeline tracks (habitat_loss.py), one per
 *  LayerSection: FOREST = plain-forest class (1), HABITAT = karst-forest class (2
 *  = langur habitat). Both load via the B4 loader from web/public/data/ (gitignored,
 *  aggregated tier), falling back to the sample until staged. Pins are local to
 *  this step for D1 (H1 lifts them to a shared store). */
export default function HabitatLossStep() {
  // One MetricSite[] per track; same study areas (same slugged ids) in each, so a
  // single siteId indexes both. Sample fallback until the JSONs are staged.
  const forestSites = useMetricSites('/data/forest_loss.json', habitatLossSites)
  const habitatSites = useMetricSites('/data/habitat_loss.json', habitatLossSites)
  const [siteId, setSiteId] = useState(habitatLossSites[0].id)
  // Year is shared with the map (via App's Outlet context) so the selector below
  // also switches the satellite basemap to the nearest available year.
  const { mapYear: year, setMapYear: setYear } = useOutletContext<MapYearContext>()
  const { isPinned, toggle, count } = usePins()
  const { compareOn, baselineYear, currentYear } = useCompare()

  // Resolve the selection in each track; when a data source swaps (sample → real)
  // the old id may not exist, so fall back to the first site (the overall rollup).
  const habitatSite: MetricSite = habitatSites.find((s) => s.id === siteId) ?? habitatSites[0]
  const forestSite: MetricSite = forestSites.find((s) => s.id === habitatSite.id) ?? forestSites[0]

  // Available display years span the loss window (year_start…year_end), newest first.
  const yearStart = habitatSite.metrics[0]?.year_start ?? 2017
  const yearEnd = habitatSite.metrics[0]?.year_end ?? 2025
  const years = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearEnd - i)

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Habitat loss"
      subtitle={
        compareOn ? (
          <span>
            Comparing {baselineYear} → {currentYear} · screening
          </span>
        ) : (
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
        )
      }
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {count} pinned
        </span>
      }
    >
      {compareOn ? (
        <CompareDashboard />
      ) : (
        <SingleYearBody
          year={year}
          yearStart={yearStart}
          sites={habitatSites}
          selectedId={habitatSite.id}
          setSiteId={setSiteId}
          forestSite={forestSite}
          habitatSite={habitatSite}
          isPinned={isPinned}
          toggle={toggle}
        />
      )}
    </Sidebar>
  )
}

function SingleYearBody({
  year,
  yearStart,
  sites,
  selectedId,
  setSiteId,
  forestSite,
  habitatSite,
  isPinned,
  toggle,
}: {
  year: number
  yearStart: number
  sites: MetricSite[]
  selectedId: string
  setSiteId: (id: string) => void
  forestSite: MetricSite
  habitatSite: MetricSite
  isPinned: (id: string) => boolean
  toggle: ReturnType<typeof usePins>['toggle']
}) {
  return (
    <>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary">
          Site
        </span>
        <select
          value={selectedId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm text-ink"
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-4">
        <LayerSection layer="forest">
          <LayerMetrics
            layer="forest"
            noun="Forest"
            site={forestSite}
            year={year}
            yearStart={yearStart}
            isPinned={isPinned}
            toggle={toggle}
          />
        </LayerSection>

        <LayerSection layer="habitat">
          <LayerMetrics
            layer="habitat"
            noun="Habitat"
            site={habitatSite}
            year={year}
            yearStart={yearStart}
            isPinned={isPinned}
            toggle={toggle}
          />
        </LayerSection>
      </div>

      <p className="mt-4 text-xs text-secondary">
        Pinned figures carry into Step 05 · Report. Screening product — not confirmed loss.
      </p>
    </>
  )
}

/** The metric cards + driver breakdown for one track (forest or habitat), read
 *  from that track's selected study area. */
function LayerMetrics({
  layer,
  noun,
  site,
  year,
  yearStart,
  isPinned,
  toggle,
}: {
  layer: HabitatLayer
  noun: string
  site: MetricSite
  year: number
  yearStart: number
  isPinned: (id: string) => boolean
  toggle: ReturnType<typeof usePins>['toggle']
}) {
  const valueOf = (metric: string) => site.metrics.find((x) => x.metric === metric)
  const drivers = DRIVERS.map((d) => ({ label: d.label, pct: valueOf(d.metric)?.value ?? 0 }))

  return (
    <div className="space-y-3">
      {CARD_SPECS.map((spec) => {
        const metricRow = valueOf(spec.metric)
        if (!metricRow) return null
        // Namespaced by layer so the forest + habitat cards never share a pin id.
        const id = `habitat-loss:${layer}:${site.id}:${spec.key}`
        const label = spec.label(noun)
        const caption = spec.caption?.(noun, year, yearStart)
        // Net loss also as a % of the start-year extent (remaining + lost = extent
        // at year_start). Shown on the delta line; falls back to the caption otherwise.
        let delta: string | undefined
        if (spec.key === 'lost') {
          const baseline = (valueOf('habitat_remaining')?.value ?? 0) + metricRow.value
          if (baseline > 0) {
            delta = `−${Math.round((metricRow.value / baseline) * 100)}% of ${yearStart}`
          }
        }
        return (
          <MetricCard
            key={spec.key}
            variant={spec.variant}
            label={label}
            value={fmt(metricRow.value)}
            unit={metricRow.unit}
            delta={delta}
            trend={delta ? 'down' : undefined}
            caption={caption}
            pinned={isPinned(id)}
            onTogglePin={() =>
              toggle({
                id,
                step: 'habitat-loss',
                label,
                value: fmt(metricRow.value),
                unit: metricRow.unit,
                detail: `${noun} · ${site.name}`,
              })
            }
          />
        )
      })}

      <DriverBreakdown drivers={drivers} />
    </div>
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
