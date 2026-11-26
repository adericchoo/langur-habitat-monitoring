import type { FeatureCollection, Geometry, Position } from 'geojson'

/**
 * Shared "spotlight" helpers — the region-focus treatment used by both the
 * analysis map (MapStage) and Step Zero (StepZeroMap), so the technique lives in
 * ONE place. The spotlight dims everything OUTSIDE the active region by painting a
 * full-extent scrim rectangle with the region's rings punched out as holes.
 */

// Full-extent ring the scrim fill paints over (a plain world rectangle).
export const WORLD_RING: Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]

export const WORLD_RECT: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD_RING] } }],
}

// Transparent hit target so the thin region outlines are clickable ("no fill").
export const regionHitFill = { id: 'region-hit', type: 'fill' as const, paint: { 'fill-opacity': 0 } }

/** Outer rings of a Polygon/MultiPolygon, used as holes to punch a region out of
 *  the scrim rectangle (the spotlight). */
export function outerRings(geom: Geometry): Position[][] {
  if (geom.type === 'Polygon') return [geom.coordinates[0]]
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly) => poly[0])
  return []
}

/** The spotlight mask fill: the world rectangle with `geom` punched out as holes,
 *  so a scrim paint over it dims only what lies OUTSIDE geom. Returns null when the
 *  geometry has no usable rings. */
export function spotlightFromGeometry(geom: Geometry): FeatureCollection | null {
  const holes = outerRings(geom)
  if (holes.length === 0) return null
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] } },
    ],
  }
}
