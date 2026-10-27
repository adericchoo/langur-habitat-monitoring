import type { RiskSite, SummaryMetric } from '../types/contract'

/**
 * SAMPLE tier only — synthetic composite-risk figures shaped to the summary
 * contract (data-contract/gee-output-spec.md). Composite habitat risk is a 0–1
 * screening score and does NOT exist upstream yet (see pipeline HANDOFF). These
 * are illustrative, NOT real measurements, locations, or confirmed threats.
 * Swapped for real outputs via the B4 loader. See SECURITY.md.
 * Lives under src/samples/ (not the gitignored `data/`).
 */

const BASE = {
  year_start: 2000,
  year_end: 2026,
  source_script: 'habitat_risk_composite (sample · upstream TODO)',
  limitations: 'Screening product — composite likelihood 0–1, not a confirmed threat.',
}

const row = (study_area: string, metric: string, value: number, unit: string): SummaryMetric => ({
  metric,
  value,
  unit,
  study_area,
  ...BASE,
})

export const habitatRiskSites: RiskSite[] = [
  {
    id: 'southern-spur',
    name: 'Southern spur (sample)',
    level: 'high',
    metrics: [
      row('Southern spur (sample)', 'composite_risk', 0.78, 'score'),
      row('Southern spur (sample)', 'exposure', 0.82, 'score'),
      row('Southern spur (sample)', 'sensitivity', 0.74, 'score'),
    ],
  },
  {
    id: 'kim-bang',
    name: 'Kim Bang block (sample)',
    level: 'med',
    metrics: [
      row('Kim Bang block (sample)', 'composite_risk', 0.51, 'score'),
      row('Kim Bang block (sample)', 'exposure', 0.58, 'score'),
      row('Kim Bang block (sample)', 'sensitivity', 0.44, 'score'),
    ],
  },
  {
    id: 'north-ridge',
    name: 'North ridge (sample)',
    level: 'low',
    metrics: [
      row('North ridge (sample)', 'composite_risk', 0.23, 'score'),
      row('North ridge (sample)', 'exposure', 0.27, 'score'),
      row('North ridge (sample)', 'sensitivity', 0.19, 'score'),
    ],
  },
]
