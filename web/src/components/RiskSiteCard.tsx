import { useId, useState } from 'react'
import RiskBadge from './RiskBadge'
import type { RiskDimension, RiskSite } from '../types/risk'

interface RiskSiteCardProps {
  site: RiskSite
  /** Live pinned state from the shared pin store (not the sample's `pinned`). */
  pinned: boolean
  onTogglePin: () => void
}

/** A single habitat-risk site. Collapsed: name + risk badge + score + pin.
 *  Expanded: adds a SEPARATE confidence band and one row per TVEG dimension.
 *  Confidence is never folded into the score — a low-confidence, high-score site
 *  is flagged "verify first" and keeps its band. */
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
            <span className="text-xs text-secondary">score {site.score.toFixed(2)}</span>
          </div>
        </button>

        <PinButton pinned={pinned} onTogglePin={onTogglePin} siteName={site.name} />
      </div>

      {expanded ? (
        <div id={panelId} className="mt-4">
          <ConfidenceBand confidence={site.confidence} />
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

/** Separate confidence block (teal-tint). Shows the confidence label + score and,
 *  when flagged, a "verify first" note — it never changes the risk score/band. */
function ConfidenceBand({ confidence }: { confidence: RiskSite['confidence'] }) {
  return (
    <div className="rounded-card bg-teal-tint px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy">Confidence</span>
        <span className="text-sm font-semibold text-teal">
          {confidence.label} · {confidence.score.toFixed(2)}
        </span>
        {confidence.verifyFirst ? (
          <span className="text-xs text-secondary">— flagged to verify first, never demoted</span>
        ) : null}
      </div>
    </div>
  )
}

/** One TVEG dimension: a teal numbered label, a provisional weight tag, the sentence. */
function DimensionRow({ index, dim }: { index: number; dim: RiskDimension }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-teal">
          {String(index).padStart(2, '0')}&nbsp;&nbsp;{dim.label}
        </span>
        <span className="shrink-0 text-xs text-secondary">w {dim.weight.toFixed(2)}</span>
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
