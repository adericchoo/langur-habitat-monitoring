import type { LayerProps } from 'react-map-gl/maplibre'
import {
  MAP_TOKENS,
  MAP_OPACITY,
  MAP_WEIGHT,
  CORRIDOR_COLOR,
  CORRIDOR_DASH,
  DRIVER_COLOR,
  DRIVER_FILL_OPACITY,
  DRIVER_HATCH_ID,
  type CorridorStatus,
  type DriverKind,
  type DriverConfidence,
} from './mapTokens'

/**
 * MapLibre paint builders for the map-canvas colour system. Every colour comes
 * from MAP_TOKENS (./mapTokens) — the single source of truth — so there is no
 * hard-coded hex here. The rules are encoded by construction:
 *   hue = category · form = geometry · opacity/hatch = confidence · weight = actionability.
 * Keying paint on a feature property (e.g. corridor `status`) is the contract seam:
 * real pipeline layers render unchanged as long as they carry the same properties.
 */

// ===== Base: dark scrim over the satellite imagery ==========================
// A full-extent fill; opacity raises when analysis layers are on so overlays pop.
export const scrimFill = (raised: boolean): LayerProps => ({
  id: 'scrim',
  type: 'fill',
  paint: {
    'fill-color': MAP_TOKENS.scrim,
    'fill-opacity': raised ? MAP_OPACITY.scrimRaised : MAP_OPACITY.scrimBase,
  },
})

// ===== Analysis regions =====================================================
// Inactive: thin pale outline, no fill. Active: a crisp white 2.5px outline.
export const regionOutline = (): LayerProps => ({
  id: 'region-outline',
  type: 'line',
  paint: {
    'line-color': MAP_TOKENS.region,
    'line-width': MAP_WEIGHT.regionInactive,
    'line-opacity': MAP_OPACITY.regionOutline,
  },
})

export const regionActiveOutline = (): LayerProps => ({
  id: 'region-active-outline',
  type: 'line',
  paint: { 'line-color': MAP_TOKENS.regionActive, 'line-width': MAP_WEIGHT.regionActive },
})

// Spotlight: dim everything OUTSIDE the active region. Fed an inverse polygon
// (world ring with the active region punched out as holes) — see MapStage.
export const spotlightMask = (): LayerProps => ({
  id: 'region-spotlight',
  type: 'fill',
  paint: { 'fill-color': MAP_TOKENS.scrim, 'fill-opacity': MAP_OPACITY.spotlightDim },
})

// ===== Protected areas — reference context, dashed line, no fill ============
export const protectedLine = (): LayerProps => ({
  id: 'pa-line',
  type: 'line',
  paint: {
    'line-color': MAP_TOKENS.protected,
    'line-width': MAP_WEIGHT.protected,
    'line-opacity': 0.9,
    'line-dasharray': [3, 2],
  },
})

// ===== Habitat patches — teal fill + brighter outline =======================
export const habitatFill = (): LayerProps => ({
  id: 'habitat-fill',
  type: 'fill',
  paint: { 'fill-color': MAP_TOKENS.habitatFill, 'fill-opacity': MAP_OPACITY.habitatFill },
})

export const habitatOutline = (): LayerProps => ({
  id: 'habitat-outline',
  type: 'line',
  paint: {
    'line-color': MAP_TOKENS.habitatOutline,
    'line-width': MAP_WEIGHT.habitatOutline,
    'line-opacity': 0.9,
  },
})

// ===== Corridors by status ==================================================
// One filtered layer per status so each carries its own weight/opacity and (when
// the colour-blind fallback is on) its own constant dash — MapLibre can't drive
// line-dasharray per feature. Weight follows actionability: intact & partial at
// 2.5px solid pop; lost at 2px/70% recedes. Render order (lost→partial→intact)
// keeps intact/partial on top; see CORRIDOR_STATUSES.
export const corridorLineFor = (
  status: CorridorStatus,
  { dashed = false }: { dashed?: boolean } = {},
): LayerProps => {
  const isLost = status === 'lost'
  const paint: NonNullable<LayerProps['paint']> = {
    'line-color': CORRIDOR_COLOR[status],
    'line-width': isLost ? MAP_WEIGHT.corridorLost : MAP_WEIGHT.corridor,
    'line-opacity': isLost ? MAP_OPACITY.corridorLost : 1,
  }
  const dash = CORRIDOR_DASH[status]
  if (dashed && dash) (paint as Record<string, unknown>)['line-dasharray'] = dash
  return {
    id: `corridor-${status}`,
    type: 'line',
    filter: ['==', ['get', 'status'], status],
    paint,
  }
}

// ===== Driver layers — hatched fills; OPACITY/HATCH = confidence =============
// `auto` (unverified) → hatched (fill-pattern) + translucent. `verified` → solid +
// opaque. Verify state ships later, so callers pass 'auto' today; the branch is
// structured now so wiring verification is a one-line change at the call site.
export const driverFill = (
  kind: DriverKind,
  { confidence = 'auto' as DriverConfidence }: { confidence?: DriverConfidence } = {},
): LayerProps => {
  const base = DRIVER_FILL_OPACITY[kind]
  return {
    id: `driver-${kind}-fill`,
    type: 'fill',
    paint:
      confidence === 'verified'
        ? { 'fill-color': DRIVER_COLOR[kind], 'fill-opacity': Math.min(1, base + 0.3) }
        : { 'fill-pattern': DRIVER_HATCH_ID[kind], 'fill-opacity': base },
  }
}

// Quarry gets a bright outline; agriculture reads on its fill alone.
export const driverOutline = (kind: DriverKind): LayerProps => ({
  id: `driver-${kind}-outline`,
  type: 'line',
  paint: {
    'line-color': kind === 'quarry' ? MAP_TOKENS.quarryOutline : DRIVER_COLOR.agriculture,
    'line-width': 1.5,
    'line-opacity': 0.9,
  },
})

// ===== Alert accent — auto-detected flags / clearing callouts ===============
export const alertLine = (): LayerProps => ({
  id: 'alert-line',
  type: 'line',
  paint: { 'line-color': MAP_TOKENS.alert, 'line-width': 2.5, 'line-opacity': 0.95 },
})

export const alertPoint = (): LayerProps => ({
  id: 'alert-point',
  type: 'circle',
  paint: {
    'circle-radius': 6,
    'circle-color': MAP_TOKENS.alert,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': MAP_TOKENS.label,
  },
})

// ===== Selected feature — white outline + soft glow (blur) ==================
export const selectedOutline = (): LayerProps => ({
  id: 'selected-outline',
  type: 'line',
  paint: {
    'line-color': MAP_TOKENS.selected,
    'line-width': MAP_WEIGHT.selected,
    'line-blur': 2,
    'line-opacity': 0.95,
  },
})

// ===== Labels — near-white over imagery, dark halo for legibility ===========
// 'Noto Sans Regular' is the font the demotiles glyph endpoint serves that covers
// the names (incl. the en-dash in "Huong Son – Lac Thuy"); 'Open Sans Regular' 404s.
export const labelSymbol = (field = 'name'): LayerProps => ({
  id: `label-${field}`,
  type: 'symbol',
  layout: {
    'text-field': ['get', field],
    'text-font': ['Noto Sans Regular'],
    'text-size': 12,
    'text-padding': 6,
    'text-allow-overlap': false,
  },
  paint: {
    'text-color': MAP_TOKENS.label,
    'text-halo-color': MAP_TOKENS.labelHalo,
    'text-halo-width': 1.6,
  },
})
