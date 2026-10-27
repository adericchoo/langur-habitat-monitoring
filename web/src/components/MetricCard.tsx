export type MetricCardVariant = 'default' | 'featured' | 'accent'
export type MetricTrend = 'up' | 'down' | 'flat'

export interface MetricCardProps {
  label: string
  value: string
  unit?: string
  /** Small change line under the value; pairs with `trend` for the arrow. */
  delta?: string
  trend?: MetricTrend
  /** Alternative small line (used when there is no `delta`). */
  caption?: string
  /** Colour emphasis. The pinned *look* is driven by the `pinned` prop below. */
  variant?: MetricCardVariant
  pinned?: boolean
  onTogglePin?: () => void
}

const TREND_GLYPH: Record<MetricTrend, string> = {
  up: '▲',
  down: '▼',
  flat: '→',
}

/**
 * A single metric: label, value(+unit), a delta/caption line, and a pin toggle.
 * Variants set colour emphasis; `pinned` swaps the "Add" button for a chip.
 */
export default function MetricCard({
  label,
  value,
  unit,
  delta,
  trend,
  caption,
  variant = 'default',
  pinned = false,
  onTogglePin,
}: MetricCardProps) {
  const featured = variant === 'featured'
  const cardCls = featured ? 'bg-navy' : 'bg-card border border-brd'
  const labelCls = featured ? 'text-teal' : 'text-secondary'
  const valueCls = featured
    ? 'text-card'
    : variant === 'accent'
      ? 'text-magenta'
      : 'text-navy'
  const subCls = featured ? 'text-teal-tint' : 'text-secondary'

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-card p-4 font-sans ${cardCls}`}
    >
      <div className="min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>{label}</p>
        <p className={`mt-1 text-2xl font-bold leading-tight ${valueCls}`}>
          {value}
          {unit ? <span className="ml-1 text-base font-semibold">{unit}</span> : null}
        </p>
        {delta ? (
          <p className={`mt-1 text-xs ${subCls}`}>
            {trend ? <span className="mr-1">{TREND_GLYPH[trend]}</span> : null}
            {delta}
          </p>
        ) : caption ? (
          <p className={`mt-1 text-xs ${subCls}`}>{caption}</p>
        ) : null}
      </div>

      <PinToggle featured={featured} pinned={pinned} onTogglePin={onTogglePin} />
    </div>
  )
}

function PinToggle({
  featured,
  pinned,
  onTogglePin,
}: {
  featured: boolean
  pinned: boolean
  onTogglePin?: () => void
}) {
  if (pinned) {
    return (
      <button
        type="button"
        onClick={onTogglePin}
        aria-pressed
        className="shrink-0 rounded-pill bg-teal-tint px-3 py-1 text-xs font-semibold text-teal"
      >
        Pinned
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onTogglePin}
      aria-pressed={false}
      className={[
        'shrink-0 rounded-pill px-3 py-1 text-xs font-semibold',
        featured ? 'bg-card text-navy' : 'border border-brd text-secondary hover:text-navy',
      ].join(' ')}
    >
      <span className="mr-1 text-teal">●</span>Add
    </button>
  )
}
