import type { ReactNode } from 'react'
import type { Step } from '../steps'

export interface StepperProps {
  steps: Step[]
  activeSlug: string
  onSelect?: (slug: string) => void
  /** Pinned at the right end of the footer (e.g. the AI for Good logo). */
  logo?: ReactNode
}

/**
 * Full-width footer stepper. Presentational: it reports clicks via `onSelect`
 * and takes the active step as a prop — routing lives with the caller.
 */
export default function Stepper({ steps, activeSlug, onSelect, logo }: StepperProps) {
  return (
    <footer className="flex items-center justify-between gap-2 border-t border-brd bg-card px-4 py-3 font-sans">
      {/* `contents` lets the step buttons sit as direct flex children of the
          footer, so justify-between spreads them evenly — logo included. */}
      <nav className="contents">
        {steps.map((step, i) => {
          const active = step.slug === activeSlug
          return (
            <button
              key={step.slug}
              type="button"
              onClick={() => onSelect?.(step.slug)}
              aria-current={active ? 'step' : undefined}
              className={[
                'flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm transition-colors',
                active ? 'bg-teal-tint text-navy' : 'text-secondary hover:text-navy',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-pill text-xs font-semibold',
                  active ? 'bg-teal text-card' : 'border border-brd text-secondary',
                ].join(' ')}
              >
                {String(i + 1).padStart(2, '0')}
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
