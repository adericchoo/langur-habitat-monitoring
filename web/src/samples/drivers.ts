import type { DriverCollection, DriverFeature, ConfidenceLabel } from '../types/drivers'
import type { DriverKind } from '../map/mapTokens'

/**
 * SAMPLE tier only — synthetic, COARSE driver blobs over the general (publicly
 * known) regions. NO real quarry / cropland boundaries or langur/threat locations
 * (SECURITY.md). Shaped to the driver contract (types/drivers.ts); replaced at
 * runtime by the real gitignored GeoJSON when staged (useDrivers → /data/drivers.json).
 *
 * Seeded so switching regions in Step Zero shows different blobs; `pu-luong` and
 * `huong-son-lac-thuy` are intentionally left with none, to exercise the empty state.
 * The 12-ha Hoa Lu blob sits below the default min-area highlight, to exercise the
 * declutter filter.
 */

const WINDOW: [number, number] = [2000, 2025]

const conf = (score: number, label: ConfidenceLabel) => ({ score, label })

/** Build a small synthetic ~square blob (side ≈ 0.02°) around a centre. */
function blob(
  id: string,
  driver: DriverKind,
  regionId: string,
  areaHa: number,
  deltaHa: number,
  confidence: { score: number; label: ConfidenceLabel },
  [lng, lat]: [number, number],
  r = 0.012,
  regionAreaHa = areaHa, // sample: assume mostly in-region (real data splits whole vs in-region)
): DriverFeature {
  return {
    type: 'Feature',
    properties: { id, driver, areaHa, regionAreaHa, deltaHa, window: WINDOW, confidence, verified: false, regionId },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng - r, lat - r],
        [lng + r, lat - r * 0.8],
        [lng + r * 0.9, lat + r],
        [lng - r * 0.8, lat + r * 0.9],
        [lng - r, lat - r],
      ]],
    },
  }
}

export const driverBlobsSample: DriverCollection = {
  type: 'FeatureCollection',
  features: [
    blob('q-kb-1', 'quarry', 'kim-bang', 1240, 38, conf(0.88, 'High'), [105.84, 20.52], 0.016),
    blob('a-kb-1', 'agriculture', 'kim-bang', 260, 44, conf(0.6, 'Moderate'), [105.805, 20.49]),
    blob('q-vl-1', 'quarry', 'van-long-dong-tam', 520, 22, conf(0.57, 'Moderate'), [105.9, 20.45]),
    blob('a-vl-1', 'agriculture', 'van-long-dong-tam', 180, 60, conf(0.34, 'Low'), [105.86, 20.432]),
    blob('q-hl-1', 'quarry', 'hoa-lu-trang-an', 880, 15, conf(0.82, 'High'), [105.885, 20.33], 0.015),
    blob('a-hl-1', 'agriculture', 'hoa-lu-trang-an', 12, 3, conf(0.28, 'Low'), [105.905, 20.302], 0.006),
    blob('a-cp-1', 'agriculture', 'cuc-phuong', 340, 51, conf(0.62, 'Moderate'), [105.62, 20.33]),
    blob('q-td-1', 'quarry', 'tam-diep', 610, 29, conf(0.79, 'High'), [105.93, 20.11]),
  ],
}
