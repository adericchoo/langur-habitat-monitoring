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
 * Small overlay legend (bottom-left) for the active map classes. Generic: the
 * caller supplies the title and colored items, so F1's risk legend can reuse it.
 * Renders nothing when there are no items.
 */
export default function MapLegend({ title, items }: MapLegendProps) {
  if (items.length === 0) return null
  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-card border border-brd bg-card p-3 font-sans shadow-sm">
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
