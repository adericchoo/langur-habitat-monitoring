import type { HabitatLossSite, SummaryMetric } from '../types/contract'

/**
 * SAMPLE tier only — synthetic figures shaped to the summary contract
 * (data-contract/gee-output-spec.md). Screening-grade, illustrative, NOT real
 * measurements or locations. Replaced by the B4 typed loader. See SECURITY.md.
 * Lives under src/samples/ (not the gitignored `data/`).
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

export const habitatLossSites: HabitatLossSite[] = [
  {
    id: 'kim-bang',
    name: 'Kim Bang block (sample)',
    metrics: [
      row('Kim Bang block (sample)', 'habitat_remaining', 12480, 'ha'),
      row('Kim Bang block (sample)', 'habitat_lost', 5120, 'ha'),
      row('Kim Bang block (sample)', 'loss_rate', 1.3, '%/yr'),
      row('Kim Bang block (sample)', 'quarry_footprint', 1240, 'ha'),
      row('Kim Bang block (sample)', 'core_habitat', 6100, 'ha'),
      row('Kim Bang block (sample)', 'driver_mining', 54, '%'),
      row('Kim Bang block (sample)', 'driver_farming', 33, '%'),
      row('Kim Bang block (sample)', 'driver_other', 13, '%'),
    ],
  },
  {
    id: 'southern-spur',
    name: 'Southern spur (sample)',
    metrics: [
      row('Southern spur (sample)', 'habitat_remaining', 3820, 'ha'),
      row('Southern spur (sample)', 'habitat_lost', 1460, 'ha'),
      row('Southern spur (sample)', 'loss_rate', 0.9, '%/yr'),
      row('Southern spur (sample)', 'quarry_footprint', 410, 'ha'),
      row('Southern spur (sample)', 'core_habitat', 1700, 'ha'),
      row('Southern spur (sample)', 'driver_mining', 41, '%'),
      row('Southern spur (sample)', 'driver_farming', 38, '%'),
      row('Southern spur (sample)', 'driver_other', 21, '%'),
    ],
  },
]
