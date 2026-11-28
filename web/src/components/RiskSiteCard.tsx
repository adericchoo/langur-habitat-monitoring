import { useId, useState } from 'react'
import RiskBadge from './RiskBadge'
import { ACTION_LABEL } from '../results/riskDashboard'
import type { RiskDimension, RiskSite } from '../types/risk'

interface RiskSiteCardProps {
  site: RiskSite
  /** Live pinned state from the shared pin store (not the sample's `pinned`). */
  pinned: boolean
  onTogglePin: () => void
}

/** A single habitat-risk site, read through its most urgent area. Collapsed:
 *  name + risk badge + the scorer's 0–100 priority and triage action + pin.
 *  Expanded: a SEPARATE confidence band, the scorer's top contributors ("why it
 *  ranks here"), and one row per TVEG dimension. Confidence is never folded
 *  into the score — a low-confidence, high-score site is flagged "verify
 *  first" and keeps its band. */
export default function RiskSiteCard({ site, pinned, onTogglePin }: RiskSiteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()

  return (
    <div className="rounded-card border border-brd bg-card p-4 font-sans">
      <div className="flex items-start justify-between gap-3">
        {/* Expand/collapse toggle wraps the heading block (name + badge + score). */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <p className="flex items-center gap-1.5 text-base font-bold text-navy">
            <span
              aria-hidden="true"
              className={`inline-block text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              ▸
            </span>
            <span className="truncate">{site.name}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <RiskBadge level={site.band} />
            <span className="text-xs text-secondary">
              {site.action ? `${ACTION_LABEL[site.action]} · ` : ''}
              {site.patches !== undefined
                ? `${site.patches} suspected quarry area${site.patches === 1 ? '' : 's'} found`
                : `score ${site.score.toFixed(2)}`}
            </span>
          </div>
        </button>

        <PinButton pinned={pinned} onTogglePin={onTogglePin} siteName={site.name} />
      </div>

      {expanded ? (
        <div id={panelId} className="mt-4">
          {site.confidence.verifyFirst ? (
            <div className="mt-3 rounded-card bg-teal-tint px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy">
                Verify first
              </p>
              <p className="mt-0.5 text-sm text-secondary">
                No langur records here since 2015, so the habitat-value read is an assumption.
                Survey before acting on this score.
              </p>
            </div>
          ) : null}
          {site.why ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                Why it ranks here
              </p>
              <p className="mt-1 text-sm text-secondary">
                The strongest signals behind this rank: {site.why}.
              </p>
            </div>
          ) : null}
          <ul className="mt-4 space-y-4">
            {site.dimensions.map((dim, i) => (
              <DimensionRow key={dim.key} index={i + 1} dim={dim} />
            ))}
          </ul>

        </div>
      ) : null}
    </div>
  )
}

/** The dimension's 0–1 read in plain words, coloured by signal strength
 *  (strong → green, moderate → amber, weak → burnt orange). Thresholds are
 *  display-only; literal classes so Tailwind's scanner keeps them. */
function signal(score: number): { label: string; cls: string } {
  if (score >= 0.7) return { label: 'strong signal', cls: 'bg-map-habitat' }
  if (score >= 0.4) return { label: 'moderate signal', cls: 'bg-map-partial' }
  return { label: 'weak signal', cls: 'bg-map-loss' }
}

/** One TVEG dimension: a teal numbered label, the signal strength, the sentence. */
function DimensionRow({ index, dim }: { index: number; dim: RiskDimension }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-teal">
          {String(index).padStart(2, '0')}&nbsp;&nbsp;{dim.label}
        </span>
        <span
          className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[11px] font-semibold text-card ${signal(dim.score).cls}`}
        >
          {signal(dim.score).label}
        </span>
      </div>
      <p className="mt-1 text-sm text-secondary">{dim.sentence}</p>
    </li>
  )
}

function PinButton({
  pinned,
  onTogglePin,
  siteName,
}: {
  pinned: boolean
  onTogglePin: () => void
  siteName: string
}) {
  return (
    <button
      type="button"
      onClick={onTogglePin}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${siteName}` : `Pin ${siteName} for the report`}
      className={[
        'shrink-0 rounded-pill px-3 py-1 text-xs font-semibold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
        pinned ? 'bg-teal-tint text-teal' : 'border border-brd text-secondary hover:text-navy',
      ].join(' ')}
    >
      {pinned ? 'Pinned' : <><span className="mr-1 text-teal">●</span>Add</>}
    </button>
  )
}
