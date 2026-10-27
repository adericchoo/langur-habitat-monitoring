import { useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import RiskBadge from '../components/RiskBadge'
import { habitatRiskSites } from '../samples/habitatRisk'
import type { RiskSite } from '../types/contract'

// Sites worst-first, so the sidebar order matches how you'd triage them.
const RISK_ORDER = { high: 0, med: 1, low: 2 }
const sortedSites = [...habitatRiskSites].sort((a, b) => RISK_ORDER[a.level] - RISK_ORDER[b.level])

const scoreOf = (site: RiskSite) =>
  site.metrics.find((m) => m.metric === 'composite_risk')?.value ?? 0

/** Step 03 — Habitat risk. A comparison list: every site with its screening
 *  risk class + composite score; the map highlights the same sites by class.
 *  Pins are local to this step for F1 (H1 lifts them to a shared store). */
export default function HabitatRiskStep() {
  const [pins, setPins] = useState<Record<string, boolean>>({})
  const togglePin = (id: string) => setPins((prev) => ({ ...prev, [id]: !prev[id] }))
  const pinnedCount = useMemo(() => Object.values(pins).filter(Boolean).length, [pins])

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Habitat risk"
      subtitle="composite likelihood · screening · upstream TODO"
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {pinnedCount} pinned
        </span>
      }
    >
      <div className="space-y-3">
        {sortedSites.map((site) => (
          <RiskRow
            key={site.id}
            site={site}
            score={scoreOf(site)}
            pinned={!!pins[site.id]}
            onTogglePin={() => togglePin(site.id)}
          />
        ))}
      </div>

      <p className="mt-4 text-xs text-secondary">
        Pinned sites carry into Step 05 · Report. Composite likelihood (0–1) — a
        screening score, not a confirmed threat.
      </p>
    </Sidebar>
  )
}

function RiskRow({
  site,
  score,
  pinned,
  onTogglePin,
}: {
  site: RiskSite
  score: number
  pinned: boolean
  onTogglePin: () => void
}) {
  return (
    <div className="rounded-card border border-brd bg-card p-4 font-sans">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">{site.name}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <RiskBadge level={site.level} />
            <span className="text-xs text-secondary">score {score.toFixed(2)}</span>
          </div>
        </div>
        <PinButton pinned={pinned} onTogglePin={onTogglePin} />
      </div>
    </div>
  )
}

function PinButton({ pinned, onTogglePin }: { pinned: boolean; onTogglePin: () => void }) {
  return (
    <button
      type="button"
      onClick={onTogglePin}
      aria-pressed={pinned}
      className={[
        'shrink-0 rounded-pill px-3 py-1 text-xs font-semibold',
        pinned
          ? 'bg-teal-tint text-teal'
          : 'border border-brd text-secondary hover:text-navy',
      ].join(' ')}
    >
      {pinned ? 'Pinned' : <><span className="mr-1 text-teal">●</span>Add</>}
    </button>
  )
}
