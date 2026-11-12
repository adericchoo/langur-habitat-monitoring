import { useMemo, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import LayerControl, { type LayerToggle } from './LayerControl'
import MapLegend from './MapLegend'
import { getMapColors, type MapColors } from '../map/mapColors'
import { corridorSample, driverSample } from '../map/sampleLayers'
// NOTE: the habitat-extent polygons were removed from this repo (data + full git
// history) as a precaution — even coarsened karst outlines are not published in
// the public bundle. If a habitat overlay is wanted, it returns via the SVW-gated
// tier (B5 two-tier access), loaded at runtime from a non-public source — never
// re-committed here.
// Protected areas: 6 gazetted parks/reserves overlapping the basemap extent,
// from the public WDPA (World Database on Protected Areas) — non-sensitive
// reference data. Coarsened to 0.001° on export (see protectedAreas.json).
// Areas lying entirely outside the 2025 basemap bounds were dropped from the file.
import protectedAreasJson from '../map/protectedAreas.json'
const protectedAreas = protectedAreasJson as FeatureCollection

// Satellite basemap tiles: XYZ PNG pyramid (EPSG:3857, z8–13) built with
// gdal2tiles from the 2025 Sentinel-2 export. PNG tiles carry their own alpha,
// so the area outside the study polygon is transparent (demotiles shows
// through) and MapLibre composites them natively — no cog:// reader/decode.
// Dev serves from web/public/basemap/tiles*; prod sets the VITE_* templates to
// hosted paths. Tiles are gitignored, never committed. One XYZ pyramid per year
// we actually have imagery for (2000 + 2025 so far); add a row when a new year's
// tiles land. The sidebar's display year drives which one shows (see below).
const BASEMAP_TILES_BY_YEAR: Record<number, string> = {
  2000: import.meta.env.VITE_BASEMAP_TILES_2000 ?? '/basemap/tiles-2000/{z}/{x}/{y}.png',
  2025: import.meta.env.VITE_BASEMAP_TILES ?? '/basemap/tiles/{z}/{x}/{y}.png',
}
const BASEMAP_YEARS = Object.keys(BASEMAP_TILES_BY_YEAR).map(Number).sort((a, b) => a - b)
const LATEST_BASEMAP_YEAR = BASEMAP_YEARS[BASEMAP_YEARS.length - 1]

// We only have imagery for a few years; snap a requested display year to the
// nearest one that exists (ties go to the earlier year).
function resolveBasemapYear(year: number): number {
  return BASEMAP_YEARS.reduce(
    (best, y) => (Math.abs(y - year) < Math.abs(best - year) ? y : best),
    BASEMAP_YEARS[0],
  )
}

// Geographic extent of the tiled imagery [west, south, east, north]. Without
// this, MapLibre requests tiles outside the image; those 404 to the SPA
// index.html and throw "source image could not be decoded". Bounds confine
// requests to tiles that actually exist.
const BASEMAP_BOUNDS: [number, number, number, number] = [104.963, 19.9627, 106.0809, 20.7939]

// Satellite basemap raster layer. No colour tokens: it's real imagery, not a
// highlight. Kept fully opaque; it sits UNDER the vector highlight layers.
const satelliteRaster: LayerProps = {
  id: 'satellite-raster',
  type: 'raster',
  paint: { 'raster-opacity': 1 },
}

// Layer paint builders — map highlights use the --map-* earth-tone tokens only
// (never brand colours), resolved from design-tokens.css via getMapColors().
// (The habitat fill/outline/label builders were removed with the habitat layer.)

// Protected-area outlines: reference context, not a highlight — a pale stone
// dash (--map-pa-line) that reads on the dark imagery but stays quiet. Slightly
// transparent and finely dashed so it recedes behind the earth-tone highlights.
const paOutline = (color: string): LayerProps => ({
  id: 'pa-line',
  type: 'line',
  paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [3, 2] },
})

// Corridors coloured by their connectivity status. Keying the paint on the
// `status` property (not per-feature colours) is the contract seam: real
// pipeline corridors render unchanged as long as they carry the same statuses.
const corridorLine = (colors: MapColors): LayerProps => ({
  id: 'corridor-line',
  type: 'line',
  paint: {
    'line-width': 15,
    'line-color': [
      'match',
      ['get', 'status'],
      'intact',
      colors.habitat,
      'partial',
      colors.partial,
      /* lost */ colors.loss,
    ],
  },
})

const driverCircles = (colors: MapColors): LayerProps => ({
  id: 'driver-circles',
  type: 'circle',
  paint: {
    'circle-radius': 6,
    'circle-color': [
      'match',
      ['get', 'kind'],
      'quarry',
      colors.threat,
      'clearing',
      colors.loss,
      /* other */ colors.partial,
    ],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#ffffff',
  },
})

/**
 * Map stage: 2025 Sentinel-2 true-colour basemap (a reprojected COG streamed via
 * the cog:// protocol) over the demotiles style, with toggleable sample layers.
 * Coarse regional view — no precise locations. Montserrat map labels are
 * deferred to B3 (glyph endpoint); so is swapping the COG for hosted PMTiles.
 */
export interface MapStageProps {
  /** Active step slug. Reserved for step-driven map highlights; none are active
   *  now (the Habitat risk fill was removed — that read lives in the sidebar). */
  activeStep?: string
  /** Display year from the sidebar; snapped to the nearest basemap we have. */
  year?: number
}

export default function MapStage({ year }: MapStageProps) {
  const colors = useMemo(() => getMapColors(), [])
  const baseYear = resolveBasemapYear(year ?? LATEST_BASEMAP_YEAR)
  const basemapTiles = BASEMAP_TILES_BY_YEAR[baseYear]
  const [layers, setLayers] = useState<LayerToggle[]>([
    { id: 'satellite', label: 'Satellite', enabled: true },
    { id: 'corridors', label: 'Corridors', enabled: true },
    { id: 'pa', label: 'Protected areas', enabled: true },
    { id: 'drivers', label: 'Drivers', enabled: true },
  ])

  const isOn = (id: string) => layers.find((l) => l.id === id)?.enabled ?? false
  const toggle = (id: string) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)))

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={{ longitude: 105.52, latitude: 20.38, zoom: 8.5 }}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Satellite basemap — first child so it renders UNDER every vector
            highlight. XYZ PNG tiles (RGBA); `bounds` confines tile requests to
            the imagery extent, and the transparent areas let demotiles context
            show through outside the study area. */}
        {isOn('satellite') && (
          <Source
            key={baseYear}
            id="satellite"
            type="raster"
            tiles={[basemapTiles]}
            tileSize={256}
            minzoom={8}
            maxzoom={13}
            bounds={BASEMAP_BOUNDS}
          >
            <Layer {...satelliteRaster} />
          </Source>
        )}
        {isOn('corridors') && (
          <Source id="corridors" type="geojson" data={corridorSample}>
            <Layer {...corridorLine(colors)} />
          </Source>
        )}
        {isOn('pa') && (
          <Source id="pa" type="geojson" data={protectedAreas}>
            <Layer {...paOutline(colors.paLine)} />
          </Source>
        )}
        {isOn('drivers') && (
          <Source id="drivers" type="geojson" data={driverSample}>
            <Layer {...driverCircles(colors)} />
          </Source>
        )}
      </Map>
      <LayerControl
        layers={layers.map((l) => (l.id === 'satellite' ? { ...l, label: `Satellite ${baseYear}` } : l))}
        onToggle={toggle}
      />

      {/* Legend stack — positioned once here; each MapLegend is a plain card so
          multiple (risk + corridors) stack without overlapping. */}
      {/* Legends share a min-width (set on MapLegend) so the corridor card is the
          same width whether or not the wider risk legend sits above it. */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
        {isOn('corridors') && (
          <MapLegend
            title="Corridors"
            items={[
              { label: 'Intact', color: colors.habitat },
              { label: 'Partial', color: colors.partial },
              { label: 'Lost', color: colors.loss },
            ]}
          />
        )}
      </div>
    </div>
  )
}
