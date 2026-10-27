import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import ReportGroup, { type ReportItem } from '../components/ReportGroup'
import { usePins, type PinnedItem } from '../report/pins'
import { STEPS } from '../steps'

// Steps that can contribute pinned items (everything but Report itself), in
// journey order so the report reads top-to-bottom like the workflow.
const REPORT_STEPS = STEPS.filter((s) => s.slug !== 'report')

/** One pinned item → a label/value row. Metrics carry a value (+unit) and show
 *  their site in the label; policy interventions have no value, so the detail
 *  (country) stands in. */
function toRow(item: PinnedItem): ReportItem {
  const value = item.value
    ? `${item.value}${item.unit ? ` ${item.unit}` : ''}`
    : item.detail ?? '—'
  const label = item.value && item.detail ? `${item.label} · ${item.detail}` : item.label
  return { label, value }
}

/** Assemble the pinned items into a plain-text/Markdown report. Kept as one pure
 *  function so a richer formatter — or an LLM summariser — can replace it later
 *  without touching the page. */
function buildReport(items: PinnedItem[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = [
    '# Habitat screening report',
    '',
    `Generated ${today} · ${items.length} pinned item${items.length === 1 ? '' : 's'}`,
    '',
    '_Screening product — suspected / likelihood, not confirmed. Sample data._',
    '',
  ]
  for (const step of REPORT_STEPS) {
    const group = items.filter((i) => i.step === step.slug)
    if (group.length === 0) continue
    lines.push(`## ${step.label}`)
    for (const item of group) {
      const { label, value } = toRow(item)
      lines.push(`- ${label}: ${value}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

/** Step 05 — Report. Pure consumer of the shared pin store: groups pinned items
 *  by step and assembles a preview on demand. */
export default function ReportStep() {
  const { items, count } = usePins()
  const [report, setReport] = useState<string | null>(null)

  const grouped = REPORT_STEPS.map((step) => ({
    step,
    rows: items.filter((i) => i.step === step.slug).map(toRow),
  })).filter((g) => g.rows.length > 0)

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Report"
      subtitle="pinned items by step · screening"
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          {count} pinned
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-secondary">
          No pinned items yet. Pin figures and interventions on the earlier steps — they
          gather here for the report.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ step, rows }) => (
            <ReportGroup key={step.slug} title={step.label} items={rows} />
          ))}

          <button
            type="button"
            onClick={() => setReport(buildReport(items))}
            className="w-full rounded-pill bg-navy px-4 py-2 text-sm font-semibold text-card hover:opacity-90"
          >
            {report === null ? 'Generate report' : 'Regenerate report'}
          </button>

          {report !== null && (
            <div className="rounded-card border border-brd bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                Preview
              </p>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-ink">
                {report}
              </pre>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-secondary">
        Screening product — not confirmed loss or threat. Sample data.
      </p>
    </Sidebar>
  )
}
