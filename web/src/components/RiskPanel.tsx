import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import Sidebar from './Sidebar'
import RiskSiteCard from './RiskSiteCard'
import { usePins } from '../report/pins'
import { riskDashboard, riskSites, weightsProvisional } from '../results/riskDashboard'
import type { RiskBand, RiskLoadState, RiskSite } from '../types/risk'

const BAND_LABEL: Record<RiskBand, string> = { high: 'High', med: 'Med', low: 'Low' }

// Sort keys: the composite score, or any one TVEG dimension's per-site read.
// Dimension keys match RiskDimension['key'] so we can look the read up directly.
type SortKey = 'composite' | RiskSite['dimensions'][number]['key']
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'composite', label: 'Composite risk score' },
  { key: 'threat', label: 'Threat activity' },
  { key: 'value', label: 'Habitat value at risk' },
  { key: 'exposure', label: 'Adjacent exposure' },
  { key: 'governance', label: 'Governance leverage' },
]

/** Value a site sorts on for the chosen key — the composite, or that dimension's
 *  per-site read (0 if somehow absent). Both are 0–1, higher = ranked first. */
function sortValue(site: RiskSite, key: SortKey): number {
  if (key === 'composite') return site.score
  return site.dimensions.find((d) => d.key === key)?.score ?? 0
}

const LOAD_STATES: RiskLoadState[] = ['loading', 'empty', 'stale', 'error', 'ready']

// Data is the committed risk summary from the real run. A `?risk=<state>` query
// flag lets us exercise the five load states by hand (loading / empty / stale /
// error / ready); anything else is treated as `ready`.
function useRiskLoad(): { status: RiskLoadState; sites: RiskSite[] } {
  const [params] = useSearchParams()
  const forced = params.get('risk')
  const status: RiskLoadState =
    forced && (LOAD_STATES as string[]).includes(forced) ? (forced as RiskLoadState) : 'ready'
  // loading / error / empty surface no cards; ready + stale show the sample.
  const sites = status === 'loading' || status === 'error' || status === 'empty' ? [] : riskSites
  return { status, sites }
}

/** Step 03 — Habitat risk sidebar panel. A region filter + display-year selector
 *  over a scrollable list of site cards (each pinnable into the shared Report
 *  store), fed by the priority scorer's per-site summary (results/riskDashboard).
 *  Screening-grade — a 0–1 likelihood, never a confirmed threat. */
export default function RiskPanel() {
  const { status, sites } = useRiskLoad()
  const { isPinned, toggle, count } = usePins()
  const [region, setRegion] = useState('overall')
  const [sort, setSort] = useState<SortKey>('composite')

  const filtered = region === 'overall' ? sites : sites.filter((s) => s.id === region)
  // Copy before sorting — `sites` is the shared sample array; sorting in place
  // would mutate it. Rank highest-first on the chosen key.
  const visible = [...filtered].sort((a, b) => sortValue(b, sort) - sortValue(a, sort))

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Priority areas"
      subtitle={`Risk scored on ${riskDashboard.earliest_change_year}\u2013${riskDashboard.run_year} change`}
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
          {riskSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary">
          Sort by · highest first
        </span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort sites by"
          className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm text-ink"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <RiskBody status={status} visible={visible} isPinned={isPinned} onToggle={toggle} />

      <p className="mt-4 text-xs text-secondary">
        Pinned sites carry into Step 05 · Report. The priority is{' '}
        <span className="font-semibold text-teal">
          a screening score for ranking, not a confirmed threat
        </span>
        . Each site is read through its most urgent suspected area; the four dimensions combine
        into the priority, threat and value counting most
        {weightsProvisional ? ', with provisional weighting' : ''}.
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
