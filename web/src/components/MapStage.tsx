import { useMemo, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import LayerControl, { type LayerToggle } from './LayerControl'
import MapLegend from './MapLegend'
import { getMapColors, type MapColors } from '../map/mapColors'
import { corridorSample, driverSample, habitatSample, protectedAreaSample, riskSample } from '../map/sampleLayers'

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
 * Map stage: demotiles basemap (placeholder until the self-hosted style/tiles
 * in B3) with three toggleable sample layers. Coarse regional view — no precise
 * locations. Montserrat map labels are deferred to B3 (glyph endpoint).
 */
export interface MapStageProps {
  /** Active step slug. Drives per-step highlights (e.g. the risk fill on F1). */
  activeStep?: string
}

export default function MapStage({ activeStep }: MapStageProps) {
  const colors = useMemo(() => getMapColors(), [])
  const showRisk = activeStep === 'habitat-risk'
  const [layers, setLayers] = useState<LayerToggle[]>([
    { id: 'habitat', label: 'Habitat', enabled: true },
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
        initialViewState={{ longitude: 105.85, latitude: 20.9, zoom: 9 }}
        mapStyle="https://demotiles.maplibre.org/style.json"
        style={{ width: '100%', height: '100%' }}
      >
        {showRisk && (
          <Source id="risk" type="geojson" data={riskSample}>
            <Layer {...riskFill(colors)} />
          </Source>
        )}
        {isOn('habitat') && (
          <Source id="habitat" type="geojson" data={habitatSample}>
            <Layer {...habitatFill(colors.habitat)} />
            <Layer {...habitatOutline(colors.habitat)} />
          </Source>
        )}
        {isOn('corridors') && (
          <Source id="corridors" type="geojson" data={corridorSample}>
            <Layer {...corridorLine(colors)} />
          </Source>
        )}
        {isOn('pa') && (
          <Source id="pa" type="geojson" data={protectedAreaSample}>
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
