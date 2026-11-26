import { useEffect, useState } from 'react'
import type { MetricSite, SummaryMetric } from '../types/contract'

/**
 * B4 loader — swaps pipeline-produced summary metrics in for the sample data with
 * no change to a step's render logic (see data-contract/gee-output-spec.md).
 *
 * The metrics pipeline emits contract rows (8 columns) as a sibling JSON next to
 * its CSV; that JSON is staged under web/public/data/ (gitignored, aggregated tier)
 * and fetched here at runtime. If it is absent — e.g. a clean prod build where the
 * unreviewed data was never staged — or malformed, the step keeps its `sample`
 * fallback, so the UI always renders.
 *
 * NB: this lives in report/ (not a `data/` folder) because the repo's .gitignore
 * ignores any directory named `data/` — the sensitive top-level data store.
 */

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Group flat contract rows into MetricSite[], preserving first-seen area order
 *  (the pipeline writes the "All regions (overall)" rollup first). */
export function groupMetricSites(rows: SummaryMetric[]): MetricSite[] {
  const byArea = new Map<string, MetricSite>()
  for (const r of rows) {
    let site = byArea.get(r.study_area)
    if (!site) {
      site = { id: slug(r.study_area), name: r.study_area, metrics: [] }
      byArea.set(r.study_area, site)
    }
    site.metrics.push(r)
  }
  return [...byArea.values()]
}

/** Fetch `url` (contract rows) and group into sites; fall back to `sample` until
 *  it loads, on a missing file, or on any parse error. */
export function useMetricSites(url: string, sample: MetricSite[]): MetricSite[] {
  const [sites, setSites] = useState<MetricSite[]>(sample)

  useEffect(() => {
    let alive = true
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<SummaryMetric[]>) : null))
      .then((rows) => {
        if (alive && Array.isArray(rows) && rows.length) setSites(groupMetricSites(rows))
      })
      .catch(() => {
        /* no staged data (or bad JSON) — keep the sample fallback */
      })
    return () => {
      alive = false
    }
  }, [url])

  return sites
}
