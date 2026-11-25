/**
 * Map-canvas colour system — the SINGLE source of truth for every colour drawn on
 * the MapLibre canvas. The sidebar/UI chrome keeps the AI-for-Good design tokens
 * (web/src/styles/design-tokens.css); this palette governs the MAP ONLY and never
 * feeds Tailwind or chrome. MapLibre paint takes colour strings (not CSS classes),
 * so these live as plain hexes here — layer builders in ./layers import them and
 * never hard-code hex of their own.
 *
 * System rules, encoded by HOW these are consumed (see ./layers):
 *   • HUE   = category   — cool (cyan/teal) = intact / good; warm (amber/red/rust)
 *                          = loss / pressure.
 *   • FORM  = geometry   — fill vs line vs dash vs hatch, kept separable from hue.
 *   • OPACITY / HATCH = confidence — auto / unverified reads as hatched + translucent.
 *   • WEIGHT = actionability — intact & partial pop; lost recedes.
 * Colour-blind safe: the system reads cool-vs-warm, never green-vs-red alone, and
 * corridor status also carries a solid-vs-dash FORM fallback (CORRIDOR_DASH, applied
 * behind a prop in layers.corridorLineFor).
 */

export const MAP_TOKENS = {
  scrim: '#0B1221', // dark wash over satellite
  region: '#CBD5E1', // analysis-region outline (inactive)
  regionActive: '#FFFFFF', // active region outline
  protected: '#7DD3FC', // protected-area dashed line (sky blue)
  habitatFill: '#2DD4BF', // habitat patch fill
  habitatOutline: '#5EEAD4', // habitat patch outline
  corridorIntact: '#4ADE80', // corridor — intact (green; distinct from habitat teal)
  corridorPartial: '#FFB020', // corridor — partial
  corridorLost: '#FF5470', // corridor — lost
  quarry: '#B5451F', // driver — quarry fill
  quarryOutline: '#E06A3B', // driver — quarry outline
  agriculture: '#C9A227', // driver — agriculture fill
  alert: '#FF2D95', // auto-detected flag / clearing callout
  selected: '#FFFFFF', // selected feature outline / glow
  label: '#F8FAFC', // label text
  labelHalo: '#0B1221', // label halo (over imagery)
} as const

export type MapTokenName = keyof typeof MAP_TOKENS

/** Opacity constants — kept here (not inline in paint) so there are no magic
 *  numbers in the layer builders. OPACITY/HATCH carries confidence; see the rules. */
export const MAP_OPACITY = {
  scrimBase: 0.22, // scrim over satellite, analysis layers off
  scrimRaised: 0.38, // scrim raised when analysis layers are on, so overlays pop
  regionOutline: 0.6, // inactive region outline
  spotlightDim: 0.45, // dim everything OUTSIDE the active region
  habitatFill: 0.12, // more transparent, so imagery reads through
  corridorLost: 0.7, // lost recedes beneath intact/partial
  quarryFill: 0.55,
  agricultureFill: 0.45,
} as const

/** Line weights — WEIGHT follows actionability (intact & partial pop, lost recedes). */
export const MAP_WEIGHT = {
  regionInactive: 1,
  regionActive: 2.5,
  protected: 1.5,
  corridor: 2.5, // intact / partial
  corridorLost: 2, // thinner so dense "lost" edges recede
  habitatOutline: 1.25,
  selected: 3,
} as const

export const CORRIDOR_STATUSES = ['lost', 'partial', 'intact'] as const // draw lost first → intact/partial sit on top
export type CorridorStatus = (typeof CORRIDOR_STATUSES)[number]

/** Corridor status → token, in one place so the legend and the paint agree. */
export const CORRIDOR_COLOR: Record<CorridorStatus, string> = {
  intact: MAP_TOKENS.corridorIntact,
  partial: MAP_TOKENS.corridorPartial,
  lost: MAP_TOKENS.corridorLost,
}

/** Solid-vs-dash FORM fallback for colour-blind corridor status (status stays
 *  readable when hue cannot be relied on). Applied behind a prop. */
export const CORRIDOR_DASH: Record<CorridorStatus, number[] | undefined> = {
  intact: undefined, // solid
  partial: [2, 1.5], // dashed
  lost: [0.5, 1.5], // dotted
}

export type DriverKind = 'quarry' | 'agriculture'
/** OPACITY/HATCH = confidence. `auto` (unverified) → hatched + translucent;
 *  `verified` → solid + opaque. Verify state ships later; the hook is structured now. */
export type DriverConfidence = 'auto' | 'verified'

export const DRIVER_COLOR: Record<DriverKind, string> = {
  quarry: MAP_TOKENS.quarry,
  agriculture: MAP_TOKENS.agriculture,
}
export const DRIVER_FILL_OPACITY: Record<DriverKind, number> = {
  quarry: MAP_OPACITY.quarryFill,
  agriculture: MAP_OPACITY.agricultureFill,
}
/** Hatch sprite ids, registered on the map by MapStage via ensureHatchImage(). */
export const DRIVER_HATCH_ID: Record<DriverKind, string> = {
  quarry: 'hatch-quarry',
  agriculture: 'hatch-agriculture',
}
