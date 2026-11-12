import { describe, expect, it } from 'vitest'
import { comparisonConfidence, computeInterval, maskRuleMatches, normalizeDrivers } from './computeInterval'
import type { YearData } from './types'

function makeYear(partial: Partial<YearData> & { year: number }): YearData {
  return {
    maskRule: 'forest-mask-v2',
    layerRef: `layer-${partial.year}`,
    remainingHa: 10000,
    coreHa: 8000,
    quarryHa: 100,
    driverSplit: { mining: 33, farming: 34, other: 33 },
    band: 'med',
    confidence: { score: 0.7, label: 'Moderate', verifyFirst: false },
    ...partial,
  }
}

describe('computeInterval', () => {
  it('derives net loss, gross loss, matrix and rate for a shrinking forest', () => {
    const baseline = makeYear({ year: 2017, remainingHa: 57600 })
    const current = makeYear({ year: 2025, remainingHa: 55900 })
    const m = computeInterval(baseline, current)

    expect(m.netChangeHa).toBe(-1700)
    expect(m.grossLossHa).toBe(1700)
    expect(m.changeMatrix).toEqual({ retained: 55900, lost: 1700, gained: 0 })
    // 1700 / 57600 / 8yr * 100
    expect(m.lossRatePctPerYr).toBe(0.37)
  })

  it('reports gain (not loss) when the later year has more forest', () => {
    const baseline = makeYear({ year: 2000, remainingHa: 100 })
    const current = makeYear({ year: 2010, remainingHa: 150 })
    const m = computeInterval(baseline, current)

    expect(m.netChangeHa).toBe(50)
    expect(m.grossLossHa).toBe(0)
    expect(m.changeMatrix).toEqual({ retained: 100, lost: 0, gained: 50 })
    expect(m.lossRatePctPerYr).toBe(0) // no loss -> zero rate
  })

  it('never divides by a non-positive span (same year)', () => {
    const y = makeYear({ year: 2020, remainingHa: 1000 })
    const m = computeInterval(y, { ...y, remainingHa: 900 })
    expect(m.lossRatePctPerYr).toBe(0)
    expect(m.grossLossHa).toBe(100)
  })

  it('takes the driver split from the current year, normalized to 100', () => {
    const baseline = makeYear({ year: 2017 })
    const current = makeYear({ year: 2025, driverSplit: { mining: 23, farming: 49, other: 28 } })
    const m = computeInterval(baseline, current)
    expect(m.driverSplit).toEqual({ mining: 23, farming: 49, other: 28 })
    expect(m.driverSplit.mining + m.driverSplit.farming + m.driverSplit.other).toBe(100)
  })
})

describe('normalizeDrivers', () => {
  it('rounds to whole percents summing to exactly 100 (drift to largest)', () => {
    const d = normalizeDrivers({ mining: 1, farming: 1, other: 1 })
    expect(d.mining + d.farming + d.other).toBe(100)
    // equal thirds -> 34/33/33 with the extra point on the first-seen largest
    expect(d).toEqual({ mining: 34, farming: 33, other: 33 })
  })

  it('returns all zero when there is no loss', () => {
    expect(normalizeDrivers({ mining: 0, farming: 0, other: 0 })).toEqual({
      mining: 0,
      farming: 0,
      other: 0,
    })
  })
})

describe('comparisonConfidence', () => {
  it('returns the lower-score confidence', () => {
    const hi = { score: 0.83, label: 'High' as const, verifyFirst: false }
    const lo = { score: 0.55, label: 'Moderate' as const, verifyFirst: false }
    expect(comparisonConfidence(hi, lo).score).toBe(0.55)
    expect(comparisonConfidence(lo, hi).label).toBe('Moderate')
  })

  it('carries verifyFirst if EITHER year flags it', () => {
    const a = { score: 0.9, label: 'High' as const, verifyFirst: true }
    const b = { score: 0.4, label: 'Low' as const, verifyFirst: false }
    expect(comparisonConfidence(a, b).verifyFirst).toBe(true)
  })
})

describe('maskRuleMatches', () => {
  it('is true only when both years share a mask rule', () => {
    const a = makeYear({ year: 2017, maskRule: 'forest-mask-v2' })
    const b = makeYear({ year: 2025, maskRule: 'forest-mask-v2' })
    const c = makeYear({ year: 2000, maskRule: 'forest-mask-v1' })
    expect(maskRuleMatches(a, b)).toBe(true)
    expect(maskRuleMatches(a, c)).toBe(false)
  })
})
