import type { LayerProps } from 'react-map-gl/maplibre'
import type { MapColors } from './mapColors'

// Vector highlight paint builders — map highlights use the --map-* earth-tone
// tokens only (never brand colours), resolved from design-tokens.css via
// getMapColors(). Keying paint on a feature property (not per-feature colours) is
// the contract seam: real pipeline layers render unchanged as long as they carry
// the same property values.
//
// Extracted here (out of MapStage) so the single-year map and the D2 compare
// split-map paint identical layers from one definition.

// Protected-area outlines: reference context, not a highlight — a pale stone
// dash (--map-pa-line) that reads on the dark imagery but stays quiet.
export const paOutline = (color: string): LayerProps => ({
  id: 'pa-line',
  type: 'line',
  paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [3, 2] },
})

// Corridors coloured by their connectivity status.
export const corridorLine = (colors: MapColors): LayerProps => ({
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

export const driverCircles = (colors: MapColors): LayerProps => ({
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
