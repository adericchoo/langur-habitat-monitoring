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

export interface HabitatLossSite {
  id: string
  name: string
  /** Metric rows for this site, each shaped to the summary contract. */
  metrics: SummaryMetric[]
}
