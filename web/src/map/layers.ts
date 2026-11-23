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

// DEV-ONLY habitat-corridor overlay (Part B output). Same status-keyed colours as
// corridorLine, but thin (not 15 px bands): the real network is ~1,000+ links, so a
// hairline reads as a graph for eyeballing instead of a solid mat. Sensitive data,
// never committed — see useDevCorridors / MapStage.
export const corridorLineDev = (colors: MapColors): LayerProps => ({
  id: 'corridor-line-dev',
  type: 'line',
  paint: {
    'line-width': 2.5,
    'line-opacity': 0.85,
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

// DEV-ONLY habitat-patch overlay (Part A output). Translucent RED (not an earth
// token) deliberately, so patches stand out against the green forest basemap for
// eyeballing coverage vs known gaps. The data is sensitive and never committed —
// see useDevPatches / MapStage.
const PATCH_RED = '#ff2a2a'

export const patchFill = (): LayerProps => ({
  id: 'patch-fill',
  type: 'fill',
  paint: { 'fill-color': PATCH_RED, 'fill-opacity': 0.3 },
})

export const patchOutline = (): LayerProps => ({
  id: 'patch-outline',
  type: 'line',
  paint: { 'line-color': PATCH_RED, 'line-width': 1, 'line-opacity': 0.9 },
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
