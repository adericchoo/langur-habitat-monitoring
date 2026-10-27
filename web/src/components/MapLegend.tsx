export interface LegendItem {
  label: string
  /** CSS color string — pass the resolved --map-* token so the swatch matches the map. */
  color: string
}

export interface MapLegendProps {
  title: string
  items: LegendItem[]
}

/**
 * Small legend card for the active map classes. Generic: the caller supplies the
 * title and colored items (corridors, risk, …). Positioning is the parent's job
 * (MapStage stacks these), so this is a plain card. Renders nothing when empty.
 */
export default function MapLegend({ title, items }: MapLegendProps) {
  if (items.length === 0) return null
  return (
    <div className="min-w-[9rem] rounded-card border border-brd bg-card p-3 font-sans shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm text-ink">
            <span
              className="h-1 w-5 shrink-0 rounded-pill"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
