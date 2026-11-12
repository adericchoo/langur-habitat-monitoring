import type { ConfidenceInfo } from '../types/risk'
import type { DriverSplit, IntervalMetrics, YearData } from './types'

// Pure selectors for D2 "Compare years". No React, no I/O — unit-tested in
// computeInterval.test.ts.

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** Whole-percent driver shares summing to exactly 100 (drift → largest share).
 *  Mirrors the pipeline's _driver_shares rounding so UI and CSV agree. */
export function normalizeDrivers(d: DriverSplit): DriverSplit {
  const keys: (keyof DriverSplit)[] = ['mining', 'farming', 'other']
  const total = keys.reduce((t, k) => t + Math.max(0, d[k]), 0)
  if (total <= 0) return { mining: 0, farming: 0, other: 0 }
  const raw = keys.map((k) => ({ k, v: (100 * Math.max(0, d[k])) / total }))
  const out = { mining: 0, farming: 0, other: 0 } as DriverSplit
  raw.forEach(({ k, v }) => (out[k] = Math.round(v)))
  const drift = 100 - keys.reduce((t, k) => t + out[k], 0)
  if (drift !== 0) {
    const largest = raw.reduce((a, b) => (b.v > a.v ? b : a)).k
    out[largest] += drift
  }
  return out
}

/**
 * Derive interval metrics from an ordered (baseline, current) pair.
 *
 * SCREENING / SAMPLE. From two area snapshots we can honestly derive net change
 * and a minimal retained/lost/gained matrix (assuming no simultaneous loss AND
 * gain within the span — so gross loss here is a lower bound). Driver split is a
 * per-year sample attribute (not derivable from area scalars), taken from the
 * current year's observed mix.
 *
 * Caller is expected to pass baseline.year < current.year; the selector is
 * defensive if not (span clamps to ≥ 0 so rate never divides by a non-positive).
 */
export function computeInterval(baseline: YearData, current: YearData): IntervalMetrics {
  const span = Math.max(0, current.year - baseline.year)
  const netChangeHa = round1(current.remainingHa - baseline.remainingHa)

  const retained = Math.min(baseline.remainingHa, current.remainingHa)
  const lost = Math.max(0, baseline.remainingHa - retained)
  const gained = Math.max(0, current.remainingHa - retained)

  const grossLossHa = round1(lost)
  const lossRatePctPerYr =
    baseline.remainingHa > 0 && span > 0
      ? round2((lost / baseline.remainingHa / span) * 100)
      : 0

  return {
    grossLossHa,
    netChangeHa,
    lossRatePctPerYr,
    changeMatrix: { retained: round1(retained), lost: round1(lost), gained: round1(gained) },
    driverSplit: normalizeDrivers(current.driverSplit),
  }
}

/** Comparison confidence = the lower of the two years' confidence. `verifyFirst`
 *  carries if EITHER year flags it (never silently cleared by the comparison). */
export function comparisonConfidence(a: ConfidenceInfo, b: ConfidenceInfo): ConfidenceInfo {
  const lower = a.score <= b.score ? a : b
  return { ...lower, verifyFirst: a.verifyFirst || b.verifyFirst }
}

/** Two years are directly comparable only when the same habitat-mask rule made
 *  both. A mismatch is surfaced as a visible warning, never silently diffed. */
export function maskRuleMatches(a: YearData, b: YearData): boolean {
  return a.maskRule === b.maskRule
}
