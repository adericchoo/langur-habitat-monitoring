import type { MetricSite, SummaryMetric } from '../types/contract'

/**
 * SAMPLE tier only — synthetic fragmentation figures shaped to the summary
 * contract (data-contract/gee-output-spec.md). Fragmentation / connectivity
 * metrics do NOT exist upstream yet (see pipeline HANDOFF "Next GEE steps"), so
 * these are illustrative, NOT real measurements or locations. Screening-grade.
 * Swapped for real outputs via the B4 loader. See SECURITY.md.
 * Lives under src/samples/ (not the gitignored `data/`).
 */

const BASE = {
  year_start: 2000,
  year_end: 2026,
  source_script: 'fragmentation_metrics (sample · upstream TODO)',
  limitations: 'Screening product — placeholder landscape metrics, not field-verified.',
}

const row = (study_area: string, metric: string, value: number, unit: string): SummaryMetric => ({
  metric,
  value,
  unit,
  study_area,
  ...BASE,
})

export const fragmentationSites: MetricSite[] = [
  {
    id: 'kim-bang',
    name: 'Kim Bang block (sample)',
    metrics: [
      row('Kim Bang block (sample)', 'effective_mesh_size', 2840, 'ha'),
      row('Kim Bang block (sample)', 'num_patches', 47, 'patches'),
      row('Kim Bang block (sample)', 'largest_patch_index', 38.2, '%'),
      row('Kim Bang block (sample)', 'edge_density', 62.5, 'm/ha'),
      row('Kim Bang block (sample)', 'core_area', 6100, 'ha'),
    ],
  },
  {
    id: 'southern-spur',
    name: 'Southern spur (sample)',
    metrics: [
      row('Southern spur (sample)', 'effective_mesh_size', 910, 'ha'),
      row('Southern spur (sample)', 'num_patches', 83, 'patches'),
      row('Southern spur (sample)', 'largest_patch_index', 19.7, '%'),
      row('Southern spur (sample)', 'edge_density', 88.1, 'm/ha'),
      row('Southern spur (sample)', 'core_area', 1700, 'ha'),
    ],
  },
]
