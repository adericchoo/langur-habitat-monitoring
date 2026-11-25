import { useCallback, useMemo, useState } from 'react'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import Map, { Layer, Source, type MapLayerMouseEvent, type MapEvent } from 'react-map-gl/maplibre'
import LayerControl, { type LayerToggle } from './LayerControl'
import MapLegendCanvas from './MapLegendCanvas'
import {
  BASEMAP_BOUNDS,
  BASEMAP_INITIAL_VIEW,
  BASEMAP_TILES_BY_YEAR,
  LATEST_BASEMAP_YEAR,
  resolveBasemapYear,
  satelliteRaster,
} from '../map/basemap'
import {
  scrimFill,
  regionOutline,
  regionActiveOutline,
  spotlightMask,
  protectedLine,
  habitatFill,
  habitatOutline,
  corridorLineFor,
  driverFill,
  driverOutline,
  alertPoint,
  labelSymbol,
} from '../map/layers'
import { CORRIDOR_STATUSES, DRIVER_HATCH_ID, DRIVER_COLOR } from '../map/mapTokens'
import { ensureHatchImage } from '../map/hatch'
import { driverAreaSample, driverSample } from '../map/sampleLayers'
import { useDevPatches } from '../map/useDevPatches'
import { useDevCorridors } from '../map/useDevCorridors'
import { useDevStudyAreas } from '../map/useDevStudyAreas'
// NOTE: the habitat-extent polygons were removed from this repo (data + full git
// history) as a precaution — even coarsened karst outlines are not published in
// the public bundle. So in PRODUCTION this map shows only satellite + scrim +
// protected areas; the full colour-system showcase (regions, habitat, corridors,
// drivers, alerts) renders DEV-only on the gitignored dev overlays and synthetic
// sample geometry. See CLAUDE.md / SECURITY.md.
// Protected areas: 6 gazetted parks/reserves overlapping the basemap extent,
// from the public WDPA (World Database on Protected Areas) — non-sensitive
// reference data. Coarsened to 0.001° on export (see protectedAreas.json).
import protectedAreasJson from '../map/protectedAreas.json'
const protectedAreas = protectedAreasJson as FeatureCollection

// Full-extent rectangle the scrim fill paints over (a plain world ring).
const WORLD_RING: Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
]
const WORLD_RECT: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD_RING] } }],
}

// Transparent hit target so the thin region outlines are clickable (spec: "no fill").
const regionHitFill = { id: 'region-hit', type: 'fill' as const, paint: { 'fill-opacity': 0 } }

/** Outer rings of a Polygon/MultiPolygon, used as holes to punch the active region
 *  out of the scrim rectangle (the spotlight). */
function outerRings(geom: Geometry): Position[][] {
  if (geom.type === 'Polygon') return [geom.coordinates[0]]
  if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly) => poly[0])
  return []
}

/**
 * Map stage — a 2025 Sentinel-2 true-colour basemap over the demotiles style,
 * styled with the map-canvas colour system (../map/mapTokens + ../map/layers).
 * Coarse regional view — no precise locations in the committed path.
 */
export interface MapStageProps {
  /** Active step slug. Reserved for step-driven map highlights. */
  activeStep?: string
  /** Display year from the sidebar; snapped to the nearest basemap we have. */
  year?: number
}

export default function MapStage({ year }: MapStageProps) {
  const baseYear = resolveBasemapYear(year ?? LATEST_BASEMAP_YEAR)
  const basemapTiles = BASEMAP_TILES_BY_YEAR[baseYear]
  // DEV-ONLY overlays — sensitive pipeline outputs loaded at runtime from the
  // gitignored web/public/dev/ folder; absent entirely in production builds.
  const devPatches = useDevPatches()
  const devCorridors = useDevCorridors()
  const devStudyAreas = useDevStudyAreas()

  const [layers, setLayers] = useState<LayerToggle[]>(() => [
    { id: 'satellite', label: 'Satellite', enabled: true },
    { id: 'scrim', label: 'Scrim', enabled: true },
    { id: 'pa', label: 'Protected areas', enabled: true },
    ...(import.meta.env.DEV
      ? [
          { id: 'study-areas', label: 'Regions', enabled: true },
          { id: 'patches', label: 'Habitat patches', enabled: true },
          { id: 'corridors-dev', label: 'Habitat corridors', enabled: true },
          { id: 'drivers', label: 'Drivers (sample)', enabled: true },
          { id: 'alerts', label: 'Alerts (sample)', enabled: false },
          { id: 'cb-dashed', label: 'Colour-blind: dashed status', enabled: false },
        ]
      : []),
  ])

  const isOn = (id: string) => layers.find((l) => l.id === id)?.enabled ?? false
  const toggle = (id: string) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)))

  // Scrim raises when any analysis layer (anything beyond satellite + scrim) is on,
  // so the overlays pop against a darker base.
  const analysisOn =
    isOn('pa') ||
    (import.meta.env.DEV &&
      (isOn('study-areas') || isOn('patches') || isOn('corridors-dev') || isOn('drivers') || isOn('alerts')))

  // Active region (click to focus) → white outline + a spotlight dimming outside it.
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const dashed = isOn('cb-dashed')

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    const name = e.features?.[0]?.properties?.name as string | undefined
    // Click a region to focus it; click it again (or empty space) to clear.
    setActiveRegion((cur) => (name && name !== cur ? name : null))
  }, [])

  // Register the driver hatch sprites once the map (and style) is ready, and again
  // on demand if a layer asks for one before it exists (avoids a missing-pattern
  // first paint).
  const onLoad = useCallback((e: MapEvent) => {
    const map = e.target
    const register = (id: string) => {
      if (id === DRIVER_HATCH_ID.quarry) ensureHatchImage(map, id, { color: DRIVER_COLOR.quarry })
      else if (id === DRIVER_HATCH_ID.agriculture) ensureHatchImage(map, id, { color: DRIVER_COLOR.agriculture })
    }
    register(DRIVER_HATCH_ID.quarry)
    register(DRIVER_HATCH_ID.agriculture)
    map.on('styleimagemissing', (ev: { id: string }) => register(ev.id))
  }, [])

  // Spotlight polygon: the world rectangle with the active region punched out.
  const spotlight = useMemo<FeatureCollection | null>(() => {
    if (!activeRegion || !devStudyAreas) return null
    const feat = devStudyAreas.features.find((f) => f.properties?.name === activeRegion)
    if (!feat) return null
    const holes = outerRings(feat.geometry)
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] } }],
    }
  }, [activeRegion, devStudyAreas])

  // Which legend groups to show, from the active toggles.
  const legendGroups = [
    import.meta.env.DEV && isOn('study-areas') ? 'regions' : null,
    isOn('pa') ? 'pa' : null,
    import.meta.env.DEV && isOn('patches') ? 'habitat' : null,
    import.meta.env.DEV && isOn('corridors-dev') ? 'corridors' : null,
    import.meta.env.DEV && isOn('drivers') ? 'drivers' : null,
    import.meta.env.DEV && isOn('alerts') ? 'alert' : null,
  ].filter(Boolean) as string[]

  const regionActiveFilter = ['==', ['get', 'name'], activeRegion ?? '__none__'] as unknown as never

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={BASEMAP_INITIAL_VIEW}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactiveLayerIds={import.meta.env.DEV && isOn('study-areas') ? ['region-hit'] : undefined}
        onClick={onMapClick}
        onLoad={onLoad}
      >
        {/* Satellite basemap — first child so it renders UNDER every overlay. */}
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

        {/* Dark scrim over the imagery; raises when analysis layers are on. */}
        {isOn('scrim') && (
          <Source id="scrim" type="geojson" data={WORLD_RECT}>
            <Layer {...scrimFill(analysisOn)} />
          </Source>
        )}

        {/* DEV-ONLY: habitat patches (teal fill + outline). */}
        {import.meta.env.DEV && isOn('patches') && devPatches && (
          <Source id="patches" type="geojson" data={devPatches}>
            <Layer {...habitatFill()} />
            <Layer {...habitatOutline()} />
          </Source>
        )}

        {/* DEV-ONLY: corridors by status — one filtered layer each, lost drawn
            first so intact/partial sit on top; dashed form fallback when the
            colour-blind toggle is on. */}
        {import.meta.env.DEV && isOn('corridors-dev') && devCorridors && (
          <Source id="corridors-dev" type="geojson" data={devCorridors}>
            {CORRIDOR_STATUSES.map((status) => (
              <Layer key={status} {...corridorLineFor(status, { dashed })} />
            ))}
          </Source>
        )}

        {/* DEV-ONLY: driver areas as hatched fills (hatch = auto/unverified). */}
        {import.meta.env.DEV && isOn('drivers') && (
          <Source id="drivers" type="geojson" data={driverAreaSample}>
            <Layer {...{ ...driverFill('agriculture'), filter: ['==', ['get', 'kind'], 'agriculture'] }} />
            <Layer {...{ ...driverFill('quarry'), filter: ['==', ['get', 'kind'], 'quarry'] }} />
            <Layer {...{ ...driverOutline('quarry'), filter: ['==', ['get', 'kind'], 'quarry'] }} />
          </Source>
        )}

        {/* Protected areas — dashed cyan line, reference context. */}
        {isOn('pa') && (
          <Source id="pa" type="geojson" data={protectedAreas}>
            <Layer {...protectedLine()} />
          </Source>
        )}

        {/* DEV-ONLY: analysis regions. Hit target + inactive outlines go down
            first; the spotlight dims outside the active region; the active outline
            and labels sit on top so they stay bright. */}
        {import.meta.env.DEV && isOn('study-areas') && devStudyAreas && (
          <Source id="study-areas" type="geojson" data={devStudyAreas}>
            <Layer {...regionHitFill} />
            <Layer {...regionOutline()} />
          </Source>
        )}

        {/* Spotlight — above the base overlays, below the active-region highlight. */}
        {import.meta.env.DEV && isOn('study-areas') && spotlight && (
          <Source id="spotlight" type="geojson" data={spotlight}>
            <Layer {...spotlightMask()} />
          </Source>
        )}

        {/* Active-region highlight + region labels, on top. */}
        {import.meta.env.DEV && isOn('study-areas') && devStudyAreas && (
          <Source id="study-areas-top" type="geojson" data={devStudyAreas}>
            <Layer {...{ ...regionActiveOutline(), filter: regionActiveFilter }} />
            <Layer {...labelSymbol('name')} />
          </Source>
        )}

        {/* DEV-ONLY: alert points (auto-detected clearing flags), topmost. */}
        {import.meta.env.DEV && isOn('alerts') && (
          <Source id="alerts" type="geojson" data={driverSample}>
            <Layer {...{ ...alertPoint(), filter: ['==', ['get', 'kind'], 'clearing'] }} />
          </Source>
        )}
      </Map>

      <LayerControl
        layers={layers.map((l) => (l.id === 'satellite' ? { ...l, label: `Satellite ${baseYear}` } : l))}
        onToggle={toggle}
      />

      {/* Token-driven legend; shows only the groups whose layers are on. */}
      <div className="absolute bottom-3 left-3 z-10">
        <MapLegendCanvas active={legendGroups} />
      </div>

      {/* Region focus hint pill hidden for now — click-to-focus + spotlight still work. */}
    </div>
  )
}
