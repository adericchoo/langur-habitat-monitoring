import type { HabitatLossSite, SummaryMetric } from '../types/contract'
import { REGIONS } from '../regions/registry'

/**
 * SAMPLE tier only — synthetic figures shaped to the summary contract
 * (data-contract/gee-output-spec.md). Screening-grade, illustrative, NOT real
 * measurements or locations. Replaced by the B4 typed loader. See SECURITY.md.
 * Lives under src/samples/ (not the gitignored `data/`).
 *
 * Region names are the publicly-known karst / protected areas;
 * `habitat_remaining` is anchored to each area's published extent (ha), the rest
 * are illustrative. The "All regions (overall)" entry is derived from these —
 * see aggregateSites below.
 */

const BASE = {
  year_start: 2000,
  year_end: 2026,
  source_script: 'habitat_loss_2000_2026 (sample)',
  limitations: 'Screening product — class-transition estimate, not field-verified.',
}

const row = (study_area: string, metric: string, value: number, unit: string): SummaryMetric => ({
  metric,
  value,
  unit,
  study_area,
  ...BASE,
})

// Flat, readable spec per region; makeSite expands it to contract-shaped rows.
interface RegionSpec {
  id: string
  name: string
  remaining: number // habitat_remaining, ha (anchored to each area's published extent)
  lost: number // habitat_lost since 2000, ha
  rate: number // loss_rate, %/yr
  quarry: number // quarry_footprint, ha
  core: number // core_habitat, ha
  gain: number // forest_gain, ha (non-forest -> forest; reported alongside loss, never netted)
  mining: number // driver shares, % (mining + farming + other = 100)
  farming: number
  other: number
}

const makeSite = (s: RegionSpec): HabitatLossSite => ({
  id: s.id,
  name: s.name,
  metrics: [
    row(s.name, 'habitat_remaining', s.remaining, 'ha'),
    row(s.name, 'habitat_lost', s.lost, 'ha'),
    row(s.name, 'loss_rate', s.rate, '%/yr'),
    row(s.name, 'quarry_footprint', s.quarry, 'ha'),
    row(s.name, 'core_habitat', s.core, 'ha'),
    row(s.name, 'forest_gain', s.gain, 'ha'),
    row(s.name, 'driver_mining', s.mining, '%'),
    row(s.name, 'driver_farming', s.farming, '%'),
    row(s.name, 'driver_other', s.other, '%'),
  ],
})

// Per-region loss figures, keyed by the shared region id. `id` / `name` / the
// `remaining` extent come from the canonical registry (regions/registry.ts), so
// these sites join to the same regions the picker and map use; only the
// illustrative loss figures live here. The "Overall" study area is derived below.
type LossFigures = Omit<RegionSpec, 'id' | 'name' | 'remaining'>

const LOSS_BY_ID: Record<string, LossFigures> = {
  'pu-luong': { lost: 1840, rate: 0.7, quarry: 180, core: 7200, gain: 260, mining: 28, farming: 52, other: 20 },
  'cuc-phuong': { lost: 920, rate: 0.3, quarry: 60, core: 15800, gain: 410, mining: 12, farming: 61, other: 27 },
  'hoa-lu-trang-an': { lost: 1320, rate: 1.1, quarry: 95, core: 3100, gain: 180, mining: 22, farming: 45, other: 33 },
  'tam-diep': { lost: 1510, rate: 1.6, quarry: 540, core: 1500, gain: 90, mining: 58, farming: 29, other: 13 },
  'huong-son-lac-thuy': { lost: 1180, rate: 1.0, quarry: 320, core: 2600, gain: 150, mining: 47, farming: 36, other: 17 },
  'kim-bang': { lost: 1870, rate: 2.1, quarry: 610, core: 980, gain: 70, mining: 63, farming: 24, other: 13 },
  'van-long-dong-tam': { lost: 760, rate: 0.6, quarry: 140, core: 2400, gain: 220, mining: 31, farming: 48, other: 21 },
}

const regionalSites: HabitatLossSite[] = REGIONS.map((r) =>
  makeSite({ id: r.id, name: `${r.name} (sample)`, remaining: r.area_ha, ...LOSS_BY_ID[r.id] }),
)

const OVERALL_NAME = 'All regions (overall)'

const valueOf = (site: HabitatLossSite, metric: string) =>
  site.metrics.find((m) => m.metric === metric)?.value ?? 0

/**
 * Derive an "Overall" study area that rolls up every regional sample:
 *  - area metrics (ha) sum,
 *  - loss_rate is a mean annual rate weighted by each region's original extent
 *    (remaining + lost), kept to one decimal,
 *  - driver shares (%) are weighted by each region's lost area, rounded to whole
 *    percents.
 * Still SAMPLE tier — derived from synthetic data, not a field measurement — and
 * stays in sync if the regional figures above change.
 */
function aggregateSites(sites: HabitatLossSite[]): HabitatLossSite {
  const sum = (metric: string) => sites.reduce((t, s) => t + valueOf(s, metric), 0)
  const originalExtent = (s: HabitatLossSite) =>
    valueOf(s, 'habitat_remaining') + valueOf(s, 'habitat_lost')

  const totalLost = sum('habitat_lost')
  const totalOriginal = sites.reduce((t, s) => t + originalExtent(s), 0)

  const lossRate =
    Math.round(
      (sites.reduce((t, s) => t + valueOf(s, 'loss_rate') * originalExtent(s), 0) / totalOriginal) *
        10,
    ) / 10

  const driverShare = (metric: string) =>
    Math.round(sites.reduce((t, s) => t + valueOf(s, metric) * valueOf(s, 'habitat_lost'), 0) / totalLost)

  const r = (metric: string, value: number, unit: string) => row(OVERALL_NAME, metric, value, unit)

  return {
    id: 'overall',
    name: OVERALL_NAME,
    metrics: [
      r('habitat_remaining', sum('habitat_remaining'), 'ha'),
      r('habitat_lost', totalLost, 'ha'),
      r('loss_rate', lossRate, '%/yr'),
      r('quarry_footprint', sum('quarry_footprint'), 'ha'),
      r('core_habitat', sum('core_habitat'), 'ha'),
      r('forest_gain', sum('forest_gain'), 'ha'),
      r('driver_mining', driverShare('driver_mining'), '%'),
      r('driver_farming', driverShare('driver_farming'), '%'),
      r('driver_other', driverShare('driver_other'), '%'),
    ],
  }
}

// "All regions (overall)" first, then each region.
export const habitatLossSites: HabitatLossSite[] = [
  aggregateSites(regionalSites),
  ...regionalSites,
]
