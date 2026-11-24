import { useId, useState } from 'react'
import type { PolicyOption } from '../types/policy'
import { GRADE, capitalise } from '../results/policyDashboard'

interface PolicyOptionCardProps {
  option: PolicyOption
  pinned: boolean
  onTogglePin: () => void
}

/** One matched policy option, compact. Collapsed: grade chip, name, what it would
 *  do, and the one next step. Expanded: which patches it covers and its main
 *  source with the verbatim quote, so the claim can be checked. */
export default function PolicyOptionCard({ option, pinned, onTogglePin }: PolicyOptionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const grade = GRADE[option.grade]

  return (
    <div className="rounded-card border border-brd bg-card p-4 font-sans text-ink">
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${grade.cls}`}>
          {grade.chip}
        </span>
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${option.name}` : `Pin ${option.name} for the report`}
          className={[
            'shrink-0 rounded-pill px-3 py-1 text-xs font-semibold',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
            pinned ? 'bg-teal-tint text-teal' : 'border border-brd text-secondary hover:text-navy',
          ].join(' ')}
        >
          {pinned ? 'Pinned' : <><span className="mr-1 text-teal">●</span>Add</>}
        </button>
      </div>

      <h3 className="mt-2 text-sm font-bold leading-snug text-navy">{option.name}</h3>
      <p className="text-xs text-secondary">
        {option.kind === 'instrument' ? 'Law in force' : 'Precedent'} · {option.country}
      </p>
      <p className="mt-1.5 text-sm">{option.does}</p>

      <p className="mt-2 text-xs text-secondary">
        <span className="font-semibold uppercase tracking-wide text-teal">{grade.next}</span>{' '}
        {/[.?!]$/.test(option.next_step) ? option.next_step : `${option.next_step}.`}
        {option.more_conditions > 0 ? (
          <span> (+{option.more_conditions} more)</span>
        ) : null}
      </p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="mt-3 flex items-center gap-1 rounded-md text-xs font-semibold text-navy hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        <span
          aria-hidden="true"
          className={`inline-block text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        Source and scope
      </button>

      {expanded ? (
        <div id={panelId} className="mt-2 space-y-2 border-t border-brd pt-2 text-xs">
          <p className="text-secondary">
            <span className="font-semibold text-navy">Applies to</span> {option.applies_to}
          </p>
          <figure>
            <blockquote className="border-l-2 border-teal pl-2 italic text-ink">
              “{option.source.quote}”
            </blockquote>
            <figcaption className="mt-1 text-secondary">
              {capitalise(option.source.locator)} ·{' '}
              <a
                href={option.source.url}
                target="_blank"
                rel="noreferrer"
                title={option.source.title}
                className="font-semibold text-teal underline-offset-2 hover:underline"
              >
                {option.source.title} ↗
              </a>
            </figcaption>
          </figure>
          {!option.reviewed_by_svw ? (
            <p className="text-secondary">Not yet reviewed by SVW.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
