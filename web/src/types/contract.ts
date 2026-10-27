// TypeScript types mirroring data-contract/gee-output-spec.md (summary tables).
// The B4 loader will parse real CSV/JSON into these; until then, sample data is
// shaped to match. Keep these in sync with the data contract.

export interface SummaryMetric {
  metric: string
  value: number
  unit: string
  year_start: number
  year_end: number
  study_area: string
  source_script: string
  limitations: string
}

/** A study area with its metric rows — the common shape every metric-driven
 *  step consumes (habitat loss, fragmentation, …). Each row is contract-shaped. */
export interface MetricSite {
  id: string
  name: string
  metrics: SummaryMetric[]
}

/** Step 01 habitat-loss sites. Alias of MetricSite kept for D1's call sites. */
export type HabitatLossSite = MetricSite

/** Habitat-risk class. Derived upstream from the composite risk score (0–1);
 *  screening-grade, never a confirmed threat. Keyed by the map paint + legend. */
export type RiskLevel = 'high' | 'med' | 'low'

/** A site with a risk class plus its contract-shaped score rows (composite_risk
 *  0–1 and any sub-scores). Composite risk is upstream TODO — sample for now. */
export interface RiskSite extends MetricSite {
  level: RiskLevel
}
