import { type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePins } from '../report/pins'
import { getYearData } from '../samples/compareYears'
import type { RiskLevel } from '../types/contract'
import type { YearData, CompareLoadState } from './types'
import { useCompare } from './CompareContext'
import { comparisonConfidence, computeInterval, maskRuleMatches } from './computeInterval'
import DirectionChip from './DirectionChip'
import ChangeMatrix from './ChangeMatrix'
import LayerSection, { HabitatPending } from '../components/LayerSection'

const fmtHa = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('en-US')} ha`
const BAND_LABEL: Record<RiskLevel, string> = { high: 'High', med: 'Moderate', low: 'Low' }
const BAND_TONE: Record<RiskLevel, string> = {
  high: 'text-map-loss',
  med: 'text-map-partial',
  low: 'text-map-habitat',
}

const LOAD_STATES: CompareLoadState[] = ['loading', 'empty', 'stale', 'error', 'ready']

// Until the B4 loader lands, data is the static sample. A `?compare=<state>` query
// flag exercises the five load states by hand; anything else is `ready` (or
// `empty` when the selected pair has no data).
function useCompareLoad(hasData: boolean): CompareLoadState {
  const [params] = useSearchParams()
  const forced = params.get('compare')
  if (forced && (LOAD_STATES as string[]).includes(forced)) return forced as CompareLoadState
  return hasData ? 'ready' : 'empty'
}

/** Compare-mode body for the Habitat-loss sidebar: interval metrics for
 *  baseline→current, per-year state shown twice, guardrails, and a pin. */
export default function CompareDashboard() {
  const { baselineYear, currentYear } = useCompare()
  const { isPinned, toggle } = usePins()

  const baseline = getYearData(baselineYear)
  const current = getYearData(currentYear)
  const hasData = Boolean(baseline && current)
  const status = useCompareLoad(hasData)

  // The forest layer follows the load state; the habitat layer is always a
  // pending placeholder until the dedicated class ships. Both are stacked below.
  const forestBody = (): ReactNode => {
    if (status === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading comparison…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card border border-brd bg-card" />
        ))}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <StateNote role="alert">
        Couldn’t load the comparison. The pipeline output may be unavailable — try again.
      </StateNote>
    )
  }
  if (status === 'empty' || !baseline || !current) {
    return <StateNote>No comparison data for {baselineYear} → {currentYear}.</StateNote>
  }

  const interval = computeInterval(baseline, current)
  const confidence = comparisonConfidence(baseline.confidence, current.confidence)
  const comparable = maskRuleMatches(baseline, current)
  const spanLabel = `${baselineYear} → ${currentYear}`
  const netLoss = interval.netChangeHa < 0

  const pinId = `compare:habitat-loss:${baselineYear}-${currentYear}`
  const pinned = isPinned(pinId)

  return (
    <div className="space-y-4">
      {status === 'stale' && (
        <div className="rounded-card border border-brd bg-card px-3 py-2 text-xs text-secondary">
          <span className="mr-1.5 font-semibold text-navy">Stale</span>
          showing the last comparison — a fresher run is pending.
        </div>
      )}

      {!comparable && (
        <div
          role="alert"
          className="rounded-card border border-map-partial px-3 py-2 text-xs text-ink"
        >
          <span className="mr-1 font-semibold text-map-partial">Years not directly comparable</span>
          — {baselineYear} and {currentYear} were produced by different habitat-mask rules
          ({baseline.maskRule} vs {current.maskRule}). Treat the difference as indicative only.
        </div>
      )}

      {/* ---- Interval metrics (baseline → current) ---- */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
          Interval · {spanLabel}
        </h2>

        <IntervalRow
          label="Gross forest loss"
          value={fmtHa(interval.grossLossHa)}
          chip={<DirectionChip direction="down" tone="loss">gross loss</DirectionChip>}
          caption="possible class transition over the span (screening)"
        />
        <IntervalRow
          label="Net change"
          value={`${netLoss ? '−' : '+'}${fmtHa(interval.netChangeHa)}`}
          chip={
            <DirectionChip direction={netLoss ? 'down' : 'up'} tone={netLoss ? 'loss' : 'partial'}>
              net change
            </DirectionChip>
          }
          caption="gross loss minus regain"
        />
        <IntervalRow
          label="Loss rate"
          value={`${interval.lossRatePctPerYr} %/yr`}
          caption={`mean over ${currentYear - baselineYear} yr (screening)`}
        />

        <ChangeMatrix matrix={interval.changeMatrix} />
        <DriverBar split={interval.driverSplit} />
      </section>

      {/* ---- Single-year state, one column per year (no faked delta) ---- */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
          By year (state, not change)
        </h2>
        <YearStateTable baseline={baseline} current={current} />
      </section>

      {/* ---- Confidence (lower of the two years) ---- */}
      <div className="rounded-card border border-brd bg-card px-3 py-2 text-xs text-secondary">
        <span className="font-semibold text-navy">Comparison confidence: {confidence.label}</span>{' '}
        ({confidence.score.toFixed(2)}, the lower of {baselineYear} and {currentYear})
        {confidence.verifyFirst && (
          <span className="ml-1.5 rounded-pill border border-map-partial px-1.5 py-0.5 font-semibold text-map-partial">
            verify first
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() =>
          toggle({
            id: pinId,
            step: 'habitat-loss',
            label: `Forest lost ${spanLabel}`,
            value: fmtHa(interval.grossLossHa),
            detail: 'Compare years (screening)',
          })
        }
        aria-pressed={pinned}
        className={[
          'w-full rounded-pill px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
          pinned ? 'bg-teal-tint text-teal' : 'border border-brd text-navy hover:bg-offwhite',
        ].join(' ')}
      >
        {pinned ? 'Pinned to Report' : `Pin “Forest lost ${spanLabel}”`}
      </button>

      <p className="text-xs text-secondary">
        Screening product — possible class transitions, not confirmed loss. Interval figures are a
        lower bound on gross change; per-year rows are state, not a delta.
      </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <LayerSection layer="forest">{forestBody()}</LayerSection>
      <LayerSection layer="habitat">
        <HabitatPending />
      </LayerSection>
    </div>
  )
}

function IntervalRow({
  label,
  value,
  chip,
  caption,
}: {
  label: string
  value: string
  chip?: ReactNode
  caption?: string
}) {
  return (
    <div className="rounded-card border border-brd bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-tight text-navy tabular-nums">{value}</p>
          {caption && <p className="mt-1 text-xs text-secondary">{caption}</p>}
        </div>
        {chip && <div className="shrink-0">{chip}</div>}
      </div>
    </div>
  )
}

function YearStateTable({ baseline, current }: { baseline: YearData; current: YearData }) {
  const rows: { label: string; cell: (d: YearData) => ReactNode }[] = [
    { label: 'Habitat remaining', cell: (d) => fmtHa(d.remainingHa) },
    { label: 'Core habitat', cell: (d) => fmtHa(d.coreHa) },
    { label: 'Quarry footprint', cell: (d) => fmtHa(d.quarryHa) },
    {
      label: 'Risk band',
      cell: (d) => <span className={`font-semibold ${BAND_TONE[d.band]}`}>{BAND_LABEL[d.band]}</span>,
    },
  ]
  const valueCell = 'py-1 text-right font-semibold text-ink tabular-nums whitespace-nowrap'
  return (
    <div className="overflow-x-auto rounded-card border border-brd bg-card p-3">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="pb-1 text-left" />
            {[
              { year: baseline.year, role: 'Baseline' },
              { year: current.year, role: 'Current' },
            ].map((c) => (
              <th key={c.role} className="pb-1 pl-3 text-right align-bottom">
                <span className="block font-bold text-navy">{c.year}</span>
                <span className="block text-[10px] font-normal uppercase tracking-wide text-secondary">
                  {c.role}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-brd">
              <td className="py-1 pr-2 text-secondary">{r.label}</td>
              <td className={valueCell}>{r.cell(baseline)}</td>
              <td className={`${valueCell} pl-3`}>{r.cell(current)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DriverBar({ split }: { split: { mining: number; farming: number; other: number } }) {
  const segs = [
    { label: 'Mining', pct: split.mining, cls: 'bg-navy' },
    { label: 'Farming', pct: split.farming, cls: 'bg-teal' },
    { label: 'Other', pct: split.other, cls: 'bg-navy-tint' },
  ]
  return (
    <div className="rounded-card border border-brd bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
        Loss by driver (cleared pixels)
      </p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-pill">
        {segs.map((s) => (
          <div key={s.label} className={s.cls} style={{ width: `${s.pct}%` }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-secondary">
        {segs.map((s) => `${s.label.toLowerCase()} ${s.pct}%`).join(' · ')}
      </p>
    </div>
  )
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
