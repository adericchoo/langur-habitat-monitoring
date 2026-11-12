// Step 01 — "Compare years" (D2) VIEW types.
//
// Screening-grade, sample tier. A YearData is one year's STATE snapshot; an
// IntervalMetrics is DERIVED from an ordered (baseline, current) pair by the pure
// computeInterval() selector. No precise locations — coarsened/aggregated only
// (SECURITY.md). When the B4 loader + a real per-year time series land, the
// loader maps pipeline output into YearData and the dashboard is unchanged.

import type { RiskLevel } from '../types/contract'
import type { ConfidenceInfo } from '../types/risk'

/** Which habitat-mask rule/version produced a year's layer. Two years are only
 *  directly comparable when these match (see the guardrail in CompareDashboard). */
export type MaskRule = string

/** The three loss drivers, as shares of gross cleared area (sum ≈ 100). */
export interface DriverSplit {
  mining: number
  farming: number
  other: number
}

/** One year's state snapshot. `remainingHa`/`coreHa`/`quarryHa` are areas; the
 *  rest is screening metadata. `driverSplit` and `band` are NOT derivable from
 *  area scalars, so they are carried per-year (sample tier) and surfaced in
 *  compare mode as single-year state, never as a faked delta. */
export interface YearData {
  year: number
  maskRule: MaskRule
  /** Per-year map layer/source id (coarsened tier). */
  layerRef: string
  remainingHa: number
  coreHa: number
  quarryHa: number
  /** Driver mix observed on cleared pixels up to this year (sample tier). */
  driverSplit: DriverSplit
  /** Screening risk band for this year (sample tier; mirrors the Step-03 class). */
  band: RiskLevel
  confidence: ConfidenceInfo
}

/** Interval metrics DERIVED from an ordered (baseline, current) pair. */
export interface IntervalMetrics {
  /** Gross forest cleared over the span (ha). */
  grossLossHa: number
  /** Net forest change (ha); negative = net loss, positive = net gain. */
  netChangeHa: number
  /** Mean annual loss rate over the span (%/yr). */
  lossRatePctPerYr: number
  /** Area retained / lost / gained over the span (ha); lost − gained = −netChange. */
  changeMatrix: { retained: number; lost: number; gained: number }
  /** Loss-by-driver on the cleared pixels (shares, sum ≈ 100). */
  driverSplit: DriverSplit
}

/** Load states the compare panel can render (mirrors RiskLoadState). */
export type CompareLoadState = 'loading' | 'empty' | 'stale' | 'error' | 'ready'
