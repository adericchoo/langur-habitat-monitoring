import { useMemo, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import LayerControl, { type LayerToggle } from './LayerControl'
import MapLegend from './MapLegend'
import { getMapColors } from '../map/mapColors'
import { corridorSample, driverSample } from '../map/sampleLayers'
import {
  BASEMAP_BOUNDS,
  BASEMAP_INITIAL_VIEW,
  BASEMAP_TILES_BY_YEAR,
  LATEST_BASEMAP_YEAR,
  resolveBasemapYear,
  satelliteRaster,
} from '../map/basemap'
import { corridorLine, driverCircles, paOutline } from '../map/layers'
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

// Basemap tiles/bounds/year-resolution and the vector layer paint builders now
// live in ../map/basemap and ../map/layers so the D2 compare split-map shares
// one definition. This component's behaviour is unchanged.

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
        initialViewState={BASEMAP_INITIAL_VIEW}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
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
