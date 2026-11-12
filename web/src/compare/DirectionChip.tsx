export type ChipDirection = 'down' | 'up' | 'flat'
export type ChipTone = 'loss' | 'partial' | 'threat'

const GLYPH: Record<ChipDirection, string> = { down: '↓', up: '↑', flat: '→' }

// Map earth-tone text classes (NOT brand colours) — the spec calls for
// terracotta/amber here. Outlined pill via border-current keeps it theme-safe
// without a tint token.
const TONE_CLASS: Record<ChipTone, string> = {
  loss: 'text-map-loss',
  partial: 'text-map-partial',
  threat: 'text-map-threat',
}

/** Small direction chip for an interval delta, e.g. "↓ gross loss". Uses the map
 *  earth tones so it reads as a change signal, distinct from brand UI. */
export default function DirectionChip({
  direction,
  tone = 'loss',
  children,
}: {
  direction: ChipDirection
  tone?: ChipTone
  children: React.ReactNode
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-pill border border-current px-2 py-0.5 text-xs font-semibold',
        TONE_CLASS[tone],
      ].join(' ')}
    >
      <span aria-hidden>{GLYPH[direction]}</span>
      {children}
    </span>
  )
}
