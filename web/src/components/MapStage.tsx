import { useMemo, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import LayerControl, { type LayerToggle } from './LayerControl'
import { getMapColors, type MapColors } from '../map/mapColors'
import { driverSample, habitatSample, protectedAreaSample } from '../map/sampleLayers'

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
export default function MapStage() {
  const colors = useMemo(() => getMapColors(), [])
  const [layers, setLayers] = useState<LayerToggle[]>([
    { id: 'habitat', label: 'Habitat', enabled: true },
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
        {isOn('habitat') && (
          <Source id="habitat" type="geojson" data={habitatSample}>
            <Layer {...habitatFill(colors.habitat)} />
            <Layer {...habitatOutline(colors.habitat)} />
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
    </div>
  )
}
