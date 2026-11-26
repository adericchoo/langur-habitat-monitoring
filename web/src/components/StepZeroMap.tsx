import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import Map, { Layer, Source, type LayerProps, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
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
  labelSymbol,
} from '../map/layers'
import { MAP_TOKENS } from '../map/mapTokens'
import { WORLD_RECT, regionHitFill, spotlightFromGeometry } from '../map/spotlight'
import { useDevStudyAreas } from '../map/useDevStudyAreas'
import { useRegion } from '../regions/RegionContext'
import { regionByName } from '../regions/registry'
import BasemapOpacityControl from './BasemapOpacityControl'
import BasemapTimelapse from './BasemapTimelapse'
import protectedAreasJson from '../map/protectedAreas.json'

const protectedAreas = protectedAreasJson as FeatureCollection

// Timelapse spans 2000→2025 regardless of which years have tiles; imagery snaps to
// the nearest year we actually have (resolveBasemapYear), the readout shows the
// scrubbed year. Ticks are evenly spaced labels under the track.
const TIMELAPSE_MIN = 2000
const TIMELAPSE_MAX = 2025
const TIMELAPSE_TICKS = [2000, 2005, 2010, 2015, 2020, 2025]

// While the basemap year is changing (scrubbing/playing), the region overlays are
// hidden so you can read the raw imagery — and the basemap source swap drops them
// anyway. They reappear this long after the last year change.
const REGIONS_REVEAL_DELAY_MS = 600

/**
 * Step Zero map — BASEMAP ONLY. Satellite basemap (opacity + per-year timelapse),
 * the shared analysis regions as neutral outlines, protected areas as dashed
 * lines, and the spotlight treatment on the active region (white outline + faint
 * habitat fill + dim outside). No habitat/corridor/driver analysis layers here.
 *
 * Region geometry is the sensitive tier: loaded at runtime from the gitignored dev
 * overlay (useDevStudyAreas, the same source MapStage uses), never committed. In
 * production (no dev file) this shows satellite + scrim + protected areas only, and
 * region selection still works from the panel — only the on-map outlines/spotlight
 * are absent. Selection is lifted to the shared RegionContext, so clicking a region
 * here and picking one in the panel stay in sync.
 */
export default function StepZeroMap() {
  const { activeRegion, setActiveRegion } = useRegion()
  const devStudyAreas = useDevStudyAreas()

  const [opacity, setOpacity] = useState(1)
  const [year, setYear] = useState(LATEST_BASEMAP_YEAR)
  const [playing, setPlaying] = useState(false)

  // Hide the region overlays whenever the year changes, then re-reveal them on a
  // timer. Continuous play keeps resetting the timer, so regions stay hidden until
  // ~600ms after the final change — then they come back (they don't survive the
  // basemap source swap on their own). Skips the first render so they show on load.
  const [regionsHidden, setRegionsHidden] = useState(false)
  const firstYearRender = useRef(true)
  useEffect(() => {
    if (firstYearRender.current) {
      firstYearRender.current = false
      return
    }
    setRegionsHidden(true)
    const id = window.setTimeout(() => setRegionsHidden(false), REGIONS_REVEAL_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [year])

  const baseYear = resolveBasemapYear(year)
  const basemapTiles = BASEMAP_TILES_BY_YEAR[baseYear]

  // Satellite raster with a controllable opacity. Built as an explicit literal (not
  // a spread of satelliteRaster) so the `type: 'raster'` discriminant is preserved.
  const rasterLayer: LayerProps = {
    id: satelliteRaster.id,
    type: 'raster',
    paint: { 'raster-opacity': opacity },
  }

  // The map spotlights only a single named region (predefined). Overall / outside /
  // custom leave every outline visible with no dim.
  const activeName = activeRegion?.kind === 'predefined' ? activeRegion.name : null
  const regionActiveFilter = ['==', ['get', 'name'], activeName ?? '__none__'] as unknown as never

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const name = e.features?.[0]?.properties?.name as string | undefined
      if (!name) return
      const region = regionByName(name)
      if (!region) return
      // Click a region to focus it; click it again to clear back to no selection.
      setActiveRegion(
        activeRegion?.id === region.id ? null : { id: region.id, name: region.name, kind: 'predefined' },
      )
    },
    [activeRegion, setActiveRegion],
  )

  // Spotlight polygon: the world rectangle with the active region punched out.
  const spotlight = useMemo<FeatureCollection | null>(() => {
    if (!activeName || !devStudyAreas) return null
    const feat = devStudyAreas.features.find((f) => f.properties?.name === activeName)
    return feat ? spotlightFromGeometry(feat.geometry) : null
  }, [activeName, devStudyAreas])

  // Region overlays render only when we have geometry AND they aren't temporarily
  // hidden for a year change.
  const showRegions = Boolean(devStudyAreas) && !regionsHidden

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={BASEMAP_INITIAL_VIEW}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactiveLayerIds={showRegions ? ['region-hit'] : undefined}
        onClick={onMapClick}
      >
        {/* Satellite basemap — opacity-controlled; source swaps by year. */}
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
          <Layer {...rasterLayer} />
        </Source>

        {/* Dark scrim — analysis layers are off at this step, so the base wash. */}
        <Source id="scrim" type="geojson" data={WORLD_RECT}>
          <Layer {...scrimFill(false)} />
        </Source>

        {/* Protected areas — dashed line, reference context. */}
        <Source id="pa" type="geojson" data={protectedAreas}>
          <Layer {...protectedLine()} />
        </Source>

        {/* Regions: hit target + inactive outlines (dev-only geometry). */}
        {showRegions && devStudyAreas && (
          <Source id="study-areas" type="geojson" data={devStudyAreas}>
            <Layer {...regionHitFill} />
            <Layer {...regionOutline()} />
          </Source>
        )}

        {/* Spotlight — dims everything outside the active region. */}
        {showRegions && spotlight && (
          <Source id="spotlight" type="geojson" data={spotlight}>
            <Layer {...spotlightMask()} />
          </Source>
        )}

        {/* Active-region highlight (faint habitat fill + white outline) + labels. */}
        {showRegions && devStudyAreas && (
          <Source id="study-areas-top" type="geojson" data={devStudyAreas}>
            <Layer {...{ ...habitatFill(), filter: regionActiveFilter }} />
            <Layer {...{ ...regionActiveOutline(), filter: regionActiveFilter }} />
            <Layer {...labelSymbol('name')} />
            {activeName && (
              <Layer
                id="region-selected-sublabel"
                type="symbol"
                filter={regionActiveFilter}
                layout={{
                  'text-field': 'selected region',
                  'text-font': ['Noto Sans Regular'],
                  'text-size': 10,
                  'text-offset': [0, 1.3],
                  'text-allow-overlap': true,
                }}
                paint={{
                  'text-color': MAP_TOKENS.habitatOutline,
                  'text-halo-color': MAP_TOKENS.labelHalo,
                  'text-halo-width': 1.4,
                }}
              />
            )}
          </Source>
        )}
      </Map>

      {/* Top-left study-area eyebrow. */}
      <div
        className="pointer-events-none absolute left-4 top-3 z-10 text-xs font-semibold uppercase tracking-wider"
        style={{ color: MAP_TOKENS.label, textShadow: `0 1px 3px ${MAP_TOKENS.labelHalo}` }}
      >
        Northern Vietnam · Study area
      </div>

      {/* Top-right: opacity slider + mini legend. */}
      <div className="absolute right-3 top-3 z-10">
        <BasemapOpacityControl opacity={opacity} onOpacity={setOpacity} />
      </div>

      {/* Bottom: timelapse scrubber. */}
      <div className="absolute inset-x-4 bottom-3 z-10">
        <BasemapTimelapse
          year={year}
          onYear={setYear}
          minYear={TIMELAPSE_MIN}
          maxYear={TIMELAPSE_MAX}
          playing={playing}
          onPlayToggle={() => setPlaying((p) => !p)}
          ticks={TIMELAPSE_TICKS}
        />
      </div>
    </div>
  )
}
