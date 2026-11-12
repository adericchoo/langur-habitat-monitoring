import { getMapColors } from '../map/mapColors'
import type { IntervalMetrics } from './types'

const fmtHa = (n: number) => `${Math.round(n).toLocaleString('en-US')} ha`

/** retained / lost / gained over the span as a stacked bar + legend. Colours are
 *  the map earth tones (habitat green / loss terracotta / partial amber) so the
 *  matrix reads consistently with the map, not the brand chrome. */
export default function ChangeMatrix({ matrix }: { matrix: IntervalMetrics['changeMatrix'] }) {
  const colors = getMapColors()
  const total = Math.max(1, matrix.retained + matrix.lost + matrix.gained)
  const segs = [
    { key: 'retained', label: 'Retained', value: matrix.retained, color: colors.habitat },
    { key: 'lost', label: 'Lost', value: matrix.lost, color: colors.loss },
    { key: 'gained', label: 'Gained', value: matrix.gained, color: colors.partial },
  ]

  return (
    <div className="rounded-card border border-brd bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Change matrix</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-pill" role="img" aria-label="Retained, lost and gained forest area">
        {segs.map((s) => (
          <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-xs text-secondary">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-pill" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-ink">{s.label}</span>
            <span className="ml-auto tabular-nums">{fmtHa(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
