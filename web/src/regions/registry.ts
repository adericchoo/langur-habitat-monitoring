import { BASEMAP_BOUNDS } from '../map/basemap'

/**
 * Canonical region identity — the SINGLE source of truth for the regions every
 * step shares. This is the publishable/aggregated tier: public protected-area
 * names + aggregated hectares only (see CLAUDE.md / SECURITY.md). It carries NO
 * geometry — precise region boundaries are the sensitive tier and load at runtime
 * from the gitignored dev overlay (useDevStudyAreas), the same source MapStage
 * uses; nothing here reveals a location.
 *
 * `id` + `name` + `area_ha` are byte-identical to the dev `study_areas.geojson`
 * (`name`, `area_ha`) and to samples/habitatLoss.ts, so the map spotlight (which
 * filters on the feature `name`) and the metric steps all join to the same region.
 * Keep these three fields stable identifiers, not prose.
 */

export type RegionKind = 'predefined' | 'overall' | 'outside' | 'custom'

/** A named protected-area region (the aggregated tier — no geometry). */
export interface PredefinedRegion {
  id: string
  name: string
  area_ha: number
}

/**
 * The active analysis region, lifted into shared context (regions/RegionContext).
 * Every step reads one at a time. `patchIds` / `bbox` are the downstream seam:
 * populated once a step resolves the region against (dev-only) geometry; left
 * undefined here so nothing sensitive is baked into committed state.
 */
export interface Region {
  id: string
  name: string
  kind: RegionKind
  patchIds?: string[]
  bbox?: [number, number, number, number]
}

// The 7 regions, in the product order shared with samples/habitatLoss.ts. Names
// MUST match the dev study-area `name` exactly (incl. the en-dashes) so the map
// spotlight filter lines up.
export const REGIONS: PredefinedRegion[] = [
  { id: 'pu-luong', name: 'Pu Luong Karst', area_ha: 12409 },
  { id: 'cuc-phuong', name: 'Cuc Phuong', area_ha: 22346 },
  { id: 'hoa-lu-trang-an', name: 'Hoa Lu / Trang An', area_ha: 6181 },
  { id: 'tam-diep', name: 'Tam Diep', area_ha: 3938 },
  { id: 'huong-son-lac-thuy', name: 'Huong Son – Lac Thuy', area_ha: 5644 },
  { id: 'kim-bang', name: 'Kim Bang', area_ha: 2416 },
  { id: 'van-long-dong-tam', name: 'Van Long NR – Dong Tam', area_ha: 4281 },
]

/** Lookup a predefined region by its map `name` (what a map click carries). */
export function regionByName(name: string): PredefinedRegion | undefined {
  return REGIONS.find((r) => r.name === name)
}

const fmtHa = (ha: number) => `${ha.toLocaleString('en-US')} ha`

/**
 * A selectable row in the Step Zero panel. A superset of Region for display
 * (leading-dot accent, right-aligned meta, disabled state). `toRegion` narrows a
 * chosen option back to the shared Region shape.
 */
export interface RegionOption {
  id: string
  name: string
  kind: RegionKind
  /** Right-aligned meta text ("7 regions", "22,200 ha", "out-of-reserve patches"). */
  meta?: string
  /** Leading indicator colour. 'teal' = normal/selectable, 'magenta' = outside. */
  accent?: 'teal' | 'magenta'
  /** Custom-draw is a stub for now (terra-draw lasso is a later PR). */
  disabled?: boolean
}

export const OVERALL_OPTION: RegionOption = {
  id: 'overall',
  name: 'Overall · landscape',
  kind: 'overall',
  meta: `${REGIONS.length} regions`,
  accent: 'teal',
}

export const PREDEFINED_OPTIONS: RegionOption[] = REGIONS.map((r) => ({
  id: r.id,
  name: r.name,
  kind: 'predefined',
  meta: fmtHa(r.area_ha),
  accent: 'teal',
}))

export const OUTSIDE_OPTION: RegionOption = {
  id: 'outside',
  name: 'Outside protected areas',
  kind: 'outside',
  meta: 'out-of-reserve patches',
  accent: 'magenta',
}

export const CUSTOM_OPTION: RegionOption = {
  id: 'custom',
  name: 'Draw a custom region on the map',
  kind: 'custom',
  disabled: true,
}

/** Every selectable option in panel order (custom is rendered separately). */
export const SELECTABLE_OPTIONS: RegionOption[] = [
  OVERALL_OPTION,
  ...PREDEFINED_OPTIONS,
  OUTSIDE_OPTION,
]

/** Narrow a chosen option to the shared Region. bbox is set only for `overall`
 *  (the public basemap extent); predefined/outside bbox + patchIds are resolved
 *  downstream against geometry, so they stay undefined here. */
export function toRegion(option: RegionOption): Region {
  return {
    id: option.id,
    name: option.name,
    kind: option.kind,
    bbox: option.kind === 'overall' ? BASEMAP_BOUNDS : undefined,
  }
}
