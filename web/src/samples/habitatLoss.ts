import type { HabitatLossSite, SummaryMetric } from '../types/contract'

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
    row(s.name, 'driver_mining', s.mining, '%'),
    row(s.name, 'driver_farming', s.farming, '%'),
    row(s.name, 'driver_other', s.other, '%'),
  ],
})

// The per-region samples. The "Overall" study area is derived from these.
const regionalSites: HabitatLossSite[] = [
  { id: 'pu-luong', name: 'Pu Luong Karst (sample)', remaining: 12409, lost: 1840, rate: 0.7, quarry: 180, core: 7200, mining: 28, farming: 52, other: 20 },
  { id: 'cuc-phuong', name: 'Cuc Phuong (sample)', remaining: 22346, lost: 920, rate: 0.3, quarry: 60, core: 15800, mining: 12, farming: 61, other: 27 },
  { id: 'hoa-lu-trang-an', name: 'Hoa Lu / Trang An (sample)', remaining: 6181, lost: 1320, rate: 1.1, quarry: 95, core: 3100, mining: 22, farming: 45, other: 33 },
  { id: 'tam-diep', name: 'Tam Diep (sample)', remaining: 3938, lost: 1510, rate: 1.6, quarry: 540, core: 1500, mining: 58, farming: 29, other: 13 },
  { id: 'huong-son-lac-thuy', name: 'Huong Son – Lac Thuy (sample)', remaining: 5644, lost: 1180, rate: 1.0, quarry: 320, core: 2600, mining: 47, farming: 36, other: 17 },
  { id: 'kim-bang', name: 'Kim Bang (sample)', remaining: 2416, lost: 1870, rate: 2.1, quarry: 610, core: 980, mining: 63, farming: 24, other: 13 },
  { id: 'van-long-dong-tam', name: 'Van Long NR – Dong Tam (sample)', remaining: 4281, lost: 760, rate: 0.6, quarry: 140, core: 2400, mining: 31, farming: 48, other: 21 },
].map(makeSite)

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
