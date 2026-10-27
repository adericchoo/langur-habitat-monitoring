import type { RiskLevel } from '../types/contract'

// Risk class → label + swatch colour. Deliberately the earth-tone map-* tokens
// (not brand colours) so a badge here matches the same site's fill on the map.
// Literal classes so Tailwind's scanner keeps them.
const RISK: Record<RiskLevel, { label: string; cls: string }> = {
  high: { label: 'High', cls: 'bg-map-threat' },
  med: { label: 'Med', cls: 'bg-map-partial' },
  low: { label: 'Low', cls: 'bg-map-habitat' },
}

/** Small pill showing a screening risk class (High/Med/Low). */
export default function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, cls } = RISK[level]
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold text-card ${cls}`}
    >
      {label} risk
    </span>
  )
}
