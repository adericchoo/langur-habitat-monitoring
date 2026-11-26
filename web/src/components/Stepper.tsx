import type { ReactNode } from 'react'
import type { Step } from '../steps'

export interface StepperProps {
  steps: Step[]
  activeSlug: string
  onSelect?: (slug: string) => void
  /** Slugs that are locked (e.g. the analysis steps before a region is set):
   *  shown muted, not focusable, and never fire `onSelect`. */
  lockedSlugs?: string[]
  /** Pinned at the right end of the footer (e.g. the AI for Good logo). */
  logo?: ReactNode
}

/**
 * Full-width footer stepper. Presentational: it reports clicks via `onSelect`
 * and takes the active step as a prop — routing lives with the caller. Steps are
 * numbered from 00 (Step Zero · Set region) through 05.
 */
export default function Stepper({ steps, activeSlug, onSelect, lockedSlugs = [], logo }: StepperProps) {
  const locked = new Set(lockedSlugs)
  return (
    <footer className="flex items-center justify-between gap-2 border-t border-brd bg-card px-4 py-3 font-sans">
      {/* `contents` lets the step buttons sit as direct flex children of the
          footer, so justify-between spreads them evenly — logo included. */}
      <nav className="contents">
        {steps.map((step, i) => {
          const active = step.slug === activeSlug
          const isLocked = locked.has(step.slug) && !active
          return (
            <button
              key={step.slug}
              type="button"
              onClick={() => !isLocked && onSelect?.(step.slug)}
              disabled={isLocked}
              aria-current={active ? 'step' : undefined}
              aria-disabled={isLocked || undefined}
              title={isLocked ? 'Set a region first' : undefined}
              className={[
                'flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-teal-tint text-navy'
                  : isLocked
                    ? 'cursor-not-allowed text-navy-tint'
                    : 'text-secondary hover:text-navy',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-pill text-xs font-semibold',
                  active ? 'bg-teal text-card' : 'border border-brd text-secondary',
                  isLocked ? 'opacity-60' : '',
                ].join(' ')}
              >
                {String(i).padStart(2, '0')}
              </span>
              <span className={active ? 'font-semibold' : ''}>{step.label}</span>
            </button>
          )
        })}
      </nav>
      {logo ? <div className="flex shrink-0 items-center">{logo}</div> : null}
    </footer>
  )
}
