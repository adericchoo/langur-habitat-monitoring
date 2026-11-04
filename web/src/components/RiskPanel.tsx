import { useState, type ReactNode } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { MapYearContext } from '../App'
import Sidebar from './Sidebar'
import RiskSiteCard from './RiskSiteCard'
import { usePins } from '../report/pins'
import { habitatRiskSites } from '../samples/habitatRisk'
import type { RiskBand, RiskLoadState, RiskSite } from '../types/risk'

// Display-year window (the year selector is shared with the map via App's Outlet
// context, so changing it also snaps the basemap). Risk sample carries no per-year
// rows yet, so the range is fixed here until the pipeline emits a time series.
const YEAR_START = 2000
const YEAR_END = 2026

const BAND_LABEL: Record<RiskBand, string> = { high: 'High', med: 'Med', low: 'Low' }

const LOAD_STATES: RiskLoadState[] = ['loading', 'empty', 'stale', 'error', 'ready']

// Until the B4 loader lands, data is the static sample. A `?risk=<state>` query
// flag lets us exercise the five load states by hand (loading / empty / stale /
// error / ready); anything else is treated as `ready`.
function useRiskLoad(): { status: RiskLoadState; sites: RiskSite[] } {
  const [params] = useSearchParams()
  const forced = params.get('risk')
  const status: RiskLoadState =
    forced && (LOAD_STATES as string[]).includes(forced) ? (forced as RiskLoadState) : 'ready'
  // loading / error / empty surface no cards; ready + stale show the sample.
  const sites = status === 'loading' || status === 'error' || status === 'empty' ? [] : habitatRiskSites
  return { status, sites }
}

/** Step 03 — Habitat risk sidebar panel. A region filter + display-year selector
 *  over a scrollable list of site cards (each pinnable into the shared Report
 *  store). Screening-grade sample data — a 0–1 likelihood, never a confirmed threat. */
export default function RiskPanel() {
  const { status, sites } = useRiskLoad()
  const { mapYear: year, setMapYear: setYear } = useOutletContext<MapYearContext>()
  const { isPinned, toggle, count } = usePins()
  const [region, setRegion] = useState('overall')

  const years = Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, i) => YEAR_END - i)

  const visible = (region === 'overall' ? sites : sites.filter((s) => s.id === region)).sort(
    (a, b) => b.score - a.score,
  )

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Habitat risk"
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
          Region
        </span>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm text-ink"
        >
          <option value="overall">All regions (overall)</option>
          {habitatRiskSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <RiskBody status={status} visible={visible} isPinned={isPinned} onToggle={toggle} />

      <p className="mt-4 text-xs text-secondary">
        Pinned sites carry into Step 05 · Report. Composite likelihood (0–1) —{' '}
        <span className="font-semibold text-teal">a screening score, not a confirmed threat</span>.
        Weights provisional; combined by geometric mean.
      </p>
    </Sidebar>
  )
}

/** The data region: one of the five load states. `stale` shows the cached list
 *  under a banner; `empty` also covers a region filter that matches nothing. */
function RiskBody({
  status,
  visible,
  isPinned,
  onToggle,
}: {
  status: RiskLoadState
  visible: RiskSite[]
  isPinned: (id: string) => boolean
  onToggle: ReturnType<typeof usePins>['toggle']
}) {
  if (status === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading risk screening…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-brd bg-card" />
        ))}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <StateNote role="alert">
        Couldn’t load the risk screening. The pipeline output may be unavailable — try again.
      </StateNote>
    )
  }

  const list =
    visible.length === 0 ? (
      <StateNote>No sites match this region.</StateNote>
    ) : (
      <div className="space-y-3">
        {visible.map((site) => {
          const id = `habitat-risk:${site.id}`
          return (
            <RiskSiteCard
              key={site.id}
              site={site}
              pinned={isPinned(id)}
              onTogglePin={() =>
                onToggle({
                  id,
                  step: 'habitat-risk',
                  label: site.name,
                  value: site.score.toFixed(2),
                  detail: `${BAND_LABEL[site.band]} risk`,
                })
              }
            />
          )
        })}
      </div>
    )

  if (status === 'stale') {
    return (
      <div className="space-y-3">
        <div className="rounded-card border border-brd bg-card px-3 py-2 text-xs text-secondary">
          <span className="mr-1.5 font-semibold text-navy">Stale</span>
          showing the last screening — a fresher run is pending.
        </div>
        {list}
      </div>
    )
  }

  return list
}

function StateNote({ children, role }: { children: ReactNode; role?: 'alert' }) {
  return (
    <div
      role={role}
      className="rounded-card border border-brd bg-card px-4 py-6 text-center text-sm text-secondary"
    >
      {children}
    </div>
  )
}
