import { useMemo, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { ViewStateChangeEvent } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { getMapColors } from '../map/mapColors'
import { corridorSample, driverSample } from '../map/sampleLayers'
import protectedAreasJson from '../map/protectedAreas.json'
import {
  BASEMAP_BOUNDS,
  BASEMAP_INITIAL_VIEW,
  BASEMAP_TILES_BY_YEAR,
  resolveBasemapYearAtOrBefore,
  satelliteRaster,
} from '../map/basemap'
import { corridorLine, driverCircles, paOutline } from '../map/layers'

const protectedAreas = protectedAreasJson as FeatureCollection

type SharedView = {
  longitude: number
  latitude: number
  zoom: number
  bearing: number
  pitch: number
}

/**
 * D2 split map: two panes side by side (baseline left, current right) locked to
 * ONE shared camera — pan/zoom either and both move, because both <Map>s are
 * controlled by the same viewState. They share the demotiles style and the vector
 * highlight layers; only the per-year satellite source differs between panes.
 *
 * We only hold imagery for 2000 + 2025, so each pane's IMAGERY snaps to the
 * newest basemap at or before its year (so 2017 shows 2000, not future 2025; the
 * pane label says when they differ) while the compare metrics use the true
 * selected years. Clean seam left for a later swipe/curtain compare — not now.
 */
export default function CompareMap({
  baselineYear,
  currentYear,
}: {
  baselineYear: number
  currentYear: number
}) {
  const colors = useMemo(() => getMapColors(), [])
  const [view, setView] = useState<SharedView>({
    ...BASEMAP_INITIAL_VIEW,
    bearing: 0,
    pitch: 0,
  })
  const onMove = (e: ViewStateChangeEvent) =>
    setView({
      longitude: e.viewState.longitude,
      latitude: e.viewState.latitude,
      zoom: e.viewState.zoom,
      bearing: e.viewState.bearing,
      pitch: e.viewState.pitch,
    })

  return (
    <div className="relative flex h-full w-full">
      <MapPane year={baselineYear} role="Baseline" colors={colors} view={view} onMove={onMove} />
      <div className="w-px shrink-0 bg-brd" aria-hidden />
      <MapPane year={currentYear} role="Current" colors={colors} view={view} onMove={onMove} />
    </div>
  )
}

function MapPane({
  year,
  role,
  colors,
  view,
  onMove,
}: {
  year: number
  role: string
  colors: ReturnType<typeof getMapColors>
  view: SharedView
  onMove: (e: ViewStateChangeEvent) => void
}) {
  // Historical pane: snap to the newest imagery at or before the pane's year, so
  // the baseline never shows future imagery (2017 → 2000 with current tiles).
  const imageryYear = resolveBasemapYearAtOrBefore(year)
  const tiles = BASEMAP_TILES_BY_YEAR[imageryYear]

  return (
    <div className="relative h-full min-w-0 flex-1">
      <Map
        {...view}
        onMove={onMove}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <Source
          key={imageryYear}
          id="satellite"
          type="raster"
          tiles={[tiles]}
          tileSize={256}
          minzoom={8}
          maxzoom={13}
          bounds={BASEMAP_BOUNDS}
        >
          <Layer {...satelliteRaster} />
        </Source>
        <Source id="corridors" type="geojson" data={corridorSample}>
          <Layer {...corridorLine(colors)} />
        </Source>
        <Source id="pa" type="geojson" data={protectedAreas}>
          <Layer {...paOutline(colors.paLine)} />
        </Source>
        <Source id="drivers" type="geojson" data={driverSample}>
          <Layer {...driverCircles(colors)} />
        </Source>
      </Map>

      {/* Pane label. */}
      <div className="absolute left-3 top-3 z-10 rounded-pill border border-brd bg-card px-3 py-1 font-sans shadow-sm">
        <span className="text-sm font-bold text-navy">{year}</span>
        <span className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-secondary">
          {role}
        </span>
        {imageryYear !== year && (
          <span className="ml-1.5 text-xs text-secondary">· imagery {imageryYear}</span>
        )}
      </div>
    </div>
  )
}
