import type { FeatureCollection } from 'geojson'

/**
 * SAMPLE / COARSENED tier only.
 *
 * Every geometry below is SYNTHETIC and approximate — invented shapes over the
 * general (publicly known) region. It contains NO real langur or threat
 * locations. See SECURITY.md. Replace with real coarsened pipeline outputs
 * (per data-contract/gee-output-spec.md) when the loader (B4) lands.
 *
 * NB: this lives under src/map/ (not a `data/` folder) because `.gitignore`
 * blocks `data/` as a sensitive-data safety net.
 */

export const habitatSample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Suspected habitat (sample)' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [105.72, 20.98],
            [105.86, 21.0],
            [105.9, 20.9],
            [105.8, 20.84],
            [105.7, 20.9],
            [105.72, 20.98],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Suspected habitat (sample)' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [105.94, 20.86],
            [106.02, 20.88],
            [106.04, 20.8],
            [105.96, 20.78],
            [105.92, 20.82],
            [105.94, 20.86],
          ],
        ],
      },
    },
  ],
}

export const protectedAreaSample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Protected area (sample)' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [105.68, 21.04],
            [105.98, 21.06],
            [106.06, 20.82],
            [105.86, 20.72],
            [105.64, 20.86],
            [105.68, 21.04],
          ],
        ],
      },
    },
  ],
}

export const driverSample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'quarry', label: 'Registered quarry (sample)' },
      geometry: { type: 'Point', coordinates: [105.88, 20.92] },
    },
    {
      type: 'Feature',
      properties: { kind: 'clearing', label: 'Suspected clearing (sample)' },
      geometry: { type: 'Point', coordinates: [105.76, 20.95] },
    },
    {
      type: 'Feature',
      properties: { kind: 'clearing', label: 'Suspected clearing (sample)' },
      geometry: { type: 'Point', coordinates: [105.98, 20.83] },
    },
  ],
}
