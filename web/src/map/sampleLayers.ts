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

// Protected areas now come from real (public, WDPA) boundaries in
// protectedAreas.json — see MapStage. The synthetic PA sample was removed.

/**
 * Corridors between habitat patches, each classed intact / partial / lost.
 * SAMPLE tier — synthetic LineStrings over the general region; corridor /
 * connectivity data is upstream TODO (see HANDOFF). The `status` property is the
 * contract point: MapStage's paint `match` and the legend both key on it.
 */
export const corridorSample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      // Kim Bang ↔ Huong Son — adjacent patches, link still closed.
      type: 'Feature',
      properties: { status: 'intact', label: 'Corridor — intact (sample)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [105.835, 20.527],
          [105.815, 20.545],
          [105.792, 20.558],
        ],
      },
    },
    {
      // Van Long ↔ Kim Bang — thinning gap.
      type: 'Feature',
      properties: { status: 'partial', label: 'Corridor — partial (sample)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [105.838, 20.44],
          [105.835, 20.465],
          [105.83, 20.49],
        ],
      },
    },
    {
      // Van Long ↔ Hoa Lu / Trang An — crossing broken.
      type: 'Feature',
      properties: { status: 'lost', label: 'Corridor — lost (sample)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [105.872, 20.365],
          [105.885, 20.32],
          [105.895, 20.29],
        ],
      },
    },
  ],
}

/**
 * Per-site habitat-risk regions, each classed high / med / low. SAMPLE tier —
 * synthetic polygons over the general region; composite risk is upstream TODO.
 * The `riskLevel` property is the contract point: MapStage's risk paint `match`
 * and the risk legend both key on it (mirrors the corridor `status` pattern).
 */
export const riskSample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { riskLevel: 'low', label: 'North ridge — low (sample)' },
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
      properties: { riskLevel: 'high', label: 'Southern spur — high (sample)' },
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
    {
      type: 'Feature',
      properties: { riskLevel: 'med', label: 'Kim Bang block — med (sample)' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [105.86, 20.82],
            [105.94, 20.84],
            [105.96, 20.74],
            [105.86, 20.72],
            [105.82, 20.78],
            [105.86, 20.82],
          ],
        ],
      },
    },
  ],
}

// Threat points placed inside the coarsened habitat patches (Kim Bang, Cuc
// Phuong, Van Long) so they read as pressures within suspected habitat.
export const driverSample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'quarry', label: 'Registered quarry (sample)' },
      geometry: { type: 'Point', coordinates: [105.845, 20.52] },
    },
    {
      type: 'Feature',
      properties: { kind: 'clearing', label: 'Suspected clearing (sample)' },
      geometry: { type: 'Point', coordinates: [105.6, 20.33] },
    },
    {
      type: 'Feature',
      properties: { kind: 'clearing', label: 'Suspected clearing (sample)' },
      geometry: { type: 'Point', coordinates: [105.82, 20.42] },
    },
  ],
}
