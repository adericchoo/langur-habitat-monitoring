import { describe, expect, it } from 'vitest'
import { riskDashboard, riskSites } from './riskDashboard'

// Guards the committed risk summary: if a new run's file is copied in, these
// catch a schema change or a broken card before the UI renders it.
describe('risk dashboard data', () => {
  it('is the v1 schema with every site ranked highest risk first', () => {
    expect(riskDashboard.schema).toBe('risk-dashboard/v1')
    const scores = riskSites.map((s) => s.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(new Set(riskSites.map((s) => s.id)).size).toBe(riskSites.length)
  })

  it('keeps every score, band, confidence and dimension in range', () => {
    for (const site of riskSites) {
      expect(site.score).toBeGreaterThanOrEqual(0)
      expect(site.score).toBeLessThanOrEqual(1)
      expect(['high', 'med', 'low']).toContain(site.band)
      expect(site.confidence.score).toBeGreaterThanOrEqual(0)
      expect(site.confidence.score).toBeLessThanOrEqual(1)
      expect(site.dimensions.map((d) => d.key)).toEqual([
        'threat',
        'value',
        'exposure',
        'governance',
      ])
      const weightSum = site.dimensions.reduce((sum, d) => sum + d.weight, 0)
      expect(weightSum).toBeCloseTo(1)
      for (const d of site.dimensions) {
        expect(d.score).toBeGreaterThanOrEqual(0)
        expect(d.score).toBeLessThanOrEqual(1)
        expect(d.sentence.length).toBeGreaterThan(0)
      }
    }
  })

  it('carries no coordinates', () => {
    expect(JSON.stringify(riskDashboard)).not.toMatch(/"(lat|lon|lng|geometry|coordinates)"/)
  })
})
