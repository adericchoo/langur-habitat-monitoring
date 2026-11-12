import type { LayerProps } from 'react-map-gl/maplibre'

// Satellite basemap tiles: XYZ PNG pyramid (EPSG:3857, z8–13) built with
// gdal2tiles from the per-year Sentinel-2 / Landsat export. PNG tiles carry their
// own alpha, so the area outside the study polygon is transparent (demotiles
// shows through) and MapLibre composites them natively — no cog:// reader/decode.
// Dev serves from web/public/basemap/tiles*; prod sets the VITE_* templates to
// hosted paths. Tiles are gitignored, never committed. One XYZ pyramid per year
// we actually have imagery for (2000 + 2025 so far); add a row when a new year's
// tiles land.
//
// Extracted here (out of MapStage) so the single-year map and the D2 compare
// split-map resolve basemaps from ONE source of truth. See docs/basemap-protocol.md
// for the production (manifest-driven) direction.
export const BASEMAP_TILES_BY_YEAR: Record<number, string> = {
  2000: import.meta.env.VITE_BASEMAP_TILES_2000 ?? '/basemap/tiles-2000/{z}/{x}/{y}.png',
  2025: import.meta.env.VITE_BASEMAP_TILES ?? '/basemap/tiles/{z}/{x}/{y}.png',
}

export const BASEMAP_YEARS = Object.keys(BASEMAP_TILES_BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b)

export const LATEST_BASEMAP_YEAR = BASEMAP_YEARS[BASEMAP_YEARS.length - 1]

// We only have imagery for a few years; snap a requested year to the nearest one
// that exists (ties go to the earlier year). The requested year still drives the
// metrics — only the imagery snaps.
export function resolveBasemapYear(year: number): number {
  return BASEMAP_YEARS.reduce(
    (best, y) => (Math.abs(y - year) < Math.abs(best - year) ? y : best),
    BASEMAP_YEARS[0],
  )
}

// For a historical pane (e.g. the compare baseline), prefer the newest basemap at
// or before the requested year — never show future imagery for a past year. Falls
// back to the nearest overall when nothing precedes it. So 2017 → 2000, 2025 →
// 2025 with the current 2000 + 2025 imagery.
export function resolveBasemapYearAtOrBefore(year: number): number {
  const atOrBefore = BASEMAP_YEARS.filter((y) => y <= year)
  return atOrBefore.length ? atOrBefore[atOrBefore.length - 1] : resolveBasemapYear(year)
}

// Geographic extent of the tiled imagery [west, south, east, north]. Without
// this, MapLibre requests tiles outside the image; those 404 to the SPA
// index.html and throw "source image could not be decoded". Bounds confine
// requests to tiles that actually exist.
export const BASEMAP_BOUNDS: [number, number, number, number] = [
  104.963, 19.9627, 106.0809, 20.7939,
]

// Shared initial camera for both the single-year and compare maps.
export const BASEMAP_INITIAL_VIEW = { longitude: 105.52, latitude: 20.38, zoom: 8.5 }

// Satellite basemap raster layer. No colour tokens: it's real imagery, not a
// highlight. Kept fully opaque; it sits UNDER the vector highlight layers.
export const satelliteRaster: LayerProps = {
  id: 'satellite-raster',
  type: 'raster',
  paint: { 'raster-opacity': 1 },
}
