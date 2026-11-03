import { useMemo, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import LayerControl, { type LayerToggle } from './LayerControl'
import MapLegend from './MapLegend'
import { getMapColors, type MapColors } from '../map/mapColors'
import { corridorSample, driverSample, riskSample } from '../map/sampleLayers'
// Real habitat extent: 7 coarsened karst-patch polygons (public-safe — langur
// presence flag + screening attributes stripped at export; see habitatAreas.geojson).
// Screening-grade, approximate; label the UI accordingly.
import habitatAreasJson from '../map/habitatAreas.json'
const habitatAreas = habitatAreasJson as FeatureCollection
// Protected areas: 20 gazetted parks/reserves in the langur's historical range,
// from the public WDPA (World Database on Protected Areas) — non-sensitive
// reference data. Coarsened to 0.001° on export (see protectedAreas.json).
import protectedAreasJson from '../map/protectedAreas.json'
const protectedAreas = protectedAreasJson as FeatureCollection

// Satellite basemap tiles: XYZ PNG pyramid (EPSG:3857, z8–13) built with
// gdal2tiles from the 2025 Sentinel-2 export. PNG tiles carry their own alpha,
// so the area outside the study polygon is transparent (demotiles shows
// through) and MapLibre composites them natively — no cog:// reader/decode.
// Dev serves from web/public/basemap/tiles; prod sets VITE_BASEMAP_TILES to a
// hosted template. Tiles are gitignored, never committed.
const BASEMAP_TILES = import.meta.env.VITE_BASEMAP_TILES ?? '/basemap/tiles/{z}/{x}/{y}.png'

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
const habitatFill = (color: string): LayerProps => ({
  id: 'habitat-fill',
  type: 'fill',
  paint: { 'fill-color': color, 'fill-opacity': 0.35 },
})

const habitatOutline = (color: string): LayerProps => ({
  id: 'habitat-outline',
  type: 'line',
  paint: { 'line-color': color, 'line-width': 1.5 },
})

// Patch name labels. Uses the basemap style's glyphs for now (Open Sans); the
// Montserrat glyph endpoint is a B3 deferral. White halo keeps names legible
// over the satellite imagery. Dark --map-boundary token for the text itself.
const habitatLabel = (color: string): LayerProps => ({
  id: 'habitat-label',
  type: 'symbol',
  layout: {
    'text-field': ['get', 'name'],
    // Must be a fontstack the basemap style's glyph server actually serves.
    // demotiles only has "Open Sans Semibold"; a missing font 404s the glyph
    // fetch and fails the whole tile parse (fills + outlines vanish too).
    // Montserrat labels wait on the B3 self-hosted glyph endpoint.
    'text-font': ['Open Sans Semibold'],
    'text-size': 12,
    'text-allow-overlap': false,
  },
  paint: {
    'text-color': color,
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.5,
  },
})

const paOutline = (color: string): LayerProps => ({
  id: 'pa-line',
  type: 'line',
  paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [2, 1] },
})

// Corridors coloured by their connectivity status. Keying the paint on the
// `status` property (not per-feature colours) is the contract seam: real
// pipeline corridors render unchanged as long as they carry the same statuses.
const corridorLine = (colors: MapColors): LayerProps => ({
  id: 'corridor-line',
  type: 'line',
  paint: {
    'line-width': 3,
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

// Per-step highlight: habitat-risk regions filled by their risk class. Keyed on
// the `riskLevel` property (same seam as corridors) and the --map-* tokens, so
// the fill matches the sidebar RiskBadge and the legend for each class.
const riskFill = (colors: MapColors): LayerProps => ({
  id: 'risk-fill',
  type: 'fill',
  paint: {
    'fill-opacity': 0.45,
    'fill-color': [
      'match',
      ['get', 'riskLevel'],
      'high',
      colors.threat,
      'med',
      colors.partial,
      /* low */ colors.habitat,
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
  /** Active step slug. Drives per-step highlights (e.g. the risk fill on F1). */
  activeStep?: string
}

export default function MapStage({ activeStep }: MapStageProps) {
  const colors = useMemo(() => getMapColors(), [])
  const showRisk = activeStep === 'habitat-risk'
  const [layers, setLayers] = useState<LayerToggle[]>([
    { id: 'satellite', label: 'Satellite 2025', enabled: true },
    { id: 'habitat', label: 'Suspected habitat', enabled: true },
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
            id="satellite"
            type="raster"
            tiles={[BASEMAP_TILES]}
            tileSize={256}
            minzoom={8}
            maxzoom={13}
            bounds={BASEMAP_BOUNDS}
          >
            <Layer {...satelliteRaster} />
          </Source>
        )}
        {showRisk && (
          <Source id="risk" type="geojson" data={riskSample}>
            <Layer {...riskFill(colors)} />
          </Source>
        )}
        {isOn('habitat') && (
          <Source id="habitat" type="geojson" data={habitatAreas}>
            <Layer {...habitatFill(colors.habitat)} />
            <Layer {...habitatOutline(colors.habitat)} />
            <Layer {...habitatLabel(colors.boundary)} />
          </Source>
        )}
        {isOn('corridors') && (
          <Source id="corridors" type="geojson" data={corridorSample}>
            <Layer {...corridorLine(colors)} />
          </Source>
        )}
        {isOn('pa') && (
          <Source id="pa" type="geojson" data={protectedAreas}>
            <Layer {...paOutline(colors.boundary)} />
          </Source>
        )}
        {isOn('drivers') && (
          <Source id="drivers" type="geojson" data={driverSample}>
            <Layer {...driverCircles(colors)} />
          </Source>
        )}
      </Map>
      <LayerControl layers={layers} onToggle={toggle} />

      {/* Legend stack — positioned once here; each MapLegend is a plain card so
          multiple (risk + corridors) stack without overlapping. */}
      {/* Legends share a min-width (set on MapLegend) so the corridor card is the
          same width whether or not the wider risk legend sits above it. */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
        {showRisk && (
          <MapLegend
            title="Habitat risk"
            items={[
              { label: 'High', color: colors.threat },
              { label: 'Med', color: colors.partial },
              { label: 'Low', color: colors.habitat },
            ]}
          />
        )}
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
