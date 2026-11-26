import { forwardRef, useRef } from 'react'
import {
  OVERALL_OPTION,
  PREDEFINED_OPTIONS,
  OUTSIDE_OPTION,
  CUSTOM_OPTION,
  SELECTABLE_OPTIONS,
  type RegionOption,
} from '../regions/registry'

/** Data-level panel states. `empty` (no region selected) is handled within
 *  `ready` via the disabled CTA, per the Step Zero spec. loading/stale/error are
 *  the seam for a future region loader (sample identity is synchronous today). */
export type RegionPanelStatus = 'loading' | 'stale' | 'error' | 'ready'

export interface RegionPanelProps {
  status: RegionPanelStatus
  /** Currently-selected option id, or null (the empty sub-state). */
  activeId: string | null
  onSelect: (option: RegionOption) => void
  onContinue: () => void
}

/**
 * Step Zero region-selection panel. AIFG design tokens (not map tokens). The
 * selectable rows form one ARIA radiogroup (roving tabindex, arrow-key selection,
 * visible focus); the custom-draw row is a separate, disabled stub. The CTA is
 * enabled only once a region is set.
 */
export default function RegionPanel({ status, activeId, onSelect, onContinue }: RegionPanelProps) {
  return (
    <aside className="flex h-full w-full flex-col bg-offwhite font-sans text-ink">
      <header className="border-b border-brd px-5 py-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">Step 00 · Set region</p>
        <h1 className="text-xl font-bold text-navy">Choose your region</h1>
        <p className="mt-0.5 text-sm text-secondary">
          Pick where to analyse — a protected-area region, the whole landscape, or draw your own.
          Scrub the years to eyeball the change first.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {status === 'loading' ? (
          <LoadingState />
        ) : status === 'error' ? (
          <ErrorState />
        ) : (
          <>
            {status === 'stale' && <StaleBanner />}
            <RegionOptions activeId={activeId} onSelect={onSelect} />
          </>
        )}
      </div>

      <footer className="border-t border-brd px-5 py-4">
        {status === 'ready' && !activeId && (
          <p className="mb-2 text-center text-xs text-secondary">Select a region to continue.</p>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!activeId || status !== 'ready'}
          className="w-full rounded-pill bg-teal px-4 py-3 text-sm font-semibold text-card transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to Habitat loss →
        </button>
      </footer>
    </aside>
  )
}

function RegionOptions({
  activeId,
  onSelect,
}: {
  activeId: string | null
  onSelect: (option: RegionOption) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Roving tabindex: the selected row (or the first, when none) is the tab stop.
  const tabStopIndex = Math.max(
    0,
    SELECTABLE_OPTIONS.findIndex((o) => o.id === activeId),
  )

  // Arrow keys move focus AND select, per the radiogroup pattern.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = SELECTABLE_OPTIONS.length - 1
    let next = index
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    onSelect(SELECTABLE_OPTIONS[next])
    refs.current[next]?.focus()
  }

  // Index within SELECTABLE_OPTIONS, so refs/roving line up across the sections.
  const indexOf = (option: RegionOption) => SELECTABLE_OPTIONS.findIndex((o) => o.id === option.id)

  const renderRow = (option: RegionOption) => {
    const i = indexOf(option)
    return (
      <RegionRow
        key={option.id}
        ref={(el: HTMLButtonElement | null) => {
          refs.current[i] = el
        }}
        option={option}
        selected={activeId === option.id}
        tabIndex={i === tabStopIndex ? 0 : -1}
        onSelect={() => onSelect(option)}
        onKeyDown={(e) => onKeyDown(e, i)}
      />
    )
  }

  return (
    <div role="radiogroup" aria-label="Region" className="space-y-2">
      {renderRow(OVERALL_OPTION)}

      <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-secondary">
        Protected-area regions
      </p>
      <div className="space-y-2">{PREDEFINED_OPTIONS.map(renderRow)}</div>

      {renderRow(OUTSIDE_OPTION)}

      {/* Custom draw — stubbed; the terra-draw + Turf lasso is the next PR. */}
      <button
        type="button"
        disabled
        aria-disabled
        title="Coming soon — draw a custom region"
        /* TODO(S0-next): enable + launch the terra-draw lasso; emits a 'custom' Region. */
        className="mt-1 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-card border border-dashed border-brd px-4 py-3 text-sm font-semibold text-secondary opacity-70"
      >
        + {CUSTOM_OPTION.name}
      </button>
    </div>
  )
}

interface RegionRowProps {
  option: RegionOption
  selected: boolean
  tabIndex: number
  onSelect: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const RegionRow = forwardRef<HTMLButtonElement, RegionRowProps>(
  ({ option, selected, tabIndex, onSelect, onKeyDown }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={selected}
        tabIndex={tabIndex}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={[
          'flex w-full items-center gap-3 rounded-card border bg-card px-4 py-3 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1',
          selected ? 'border-teal bg-teal-tint' : 'border-brd hover:border-navy-tint',
        ].join(' ')}
      >
        <Indicator accent={option.accent} selected={selected} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{option.name}</span>
        {option.meta && <span className="shrink-0 text-xs text-secondary">{option.meta}</span>}
        {selected ? <CheckIcon /> : <ChevronIcon />}
      </button>
    )
  },
)
RegionRow.displayName = 'RegionRow'

function Indicator({ accent, selected }: { accent?: RegionOption['accent']; selected: boolean }) {
  if (accent === 'magenta') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-pill bg-magenta" aria-hidden />
  }
  return (
    <span
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border-2',
        selected ? 'border-teal' : 'border-navy-tint',
      ].join(' ')}
      aria-hidden
    >
      {selected && <span className="h-1.5 w-1.5 rounded-pill bg-teal" />}
    </span>
  )
}

function CheckIcon() {
  return (
    <svg className="shrink-0 text-teal" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="9" fill="currentColor" />
      <path d="M5 9.2l2.4 2.4L13 6.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="shrink-0 text-navy-tint" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoadingState() {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-card border border-brd bg-card" />
      ))}
    </div>
  )
}

function StaleBanner() {
  return (
    <p className="mb-3 rounded-card border border-brd bg-card px-3 py-2 text-xs text-secondary">
      Showing saved regions — refresh for the latest.
    </p>
  )
}

function ErrorState() {
  return (
    <div className="rounded-card border border-brd bg-card px-4 py-6 text-center">
      <p className="text-sm font-semibold text-navy">Couldn't load regions</p>
      <p className="mt-1 text-xs text-secondary">Check your connection and try again.</p>
    </div>
  )
}
