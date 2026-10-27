export interface ReportItem {
  label: string
  value: string
}

export interface ReportGroupProps {
  title: string
  items: ReportItem[]
}

/** A grouped list for the Report step: header + label/value rows with dividers. */
export default function ReportGroup({ title, items }: ReportGroupProps) {
  return (
    <div className="rounded-card border border-brd bg-card font-sans text-ink">
      <h3 className="border-b border-brd px-4 py-3 text-sm font-bold uppercase tracking-wide text-navy">
        {title}
      </h3>
      <dl className="divide-y divide-brd">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="min-w-0 text-sm text-secondary">{item.label}</dt>
            <dd className="shrink-0 text-sm font-semibold text-navy">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
