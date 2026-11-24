import { describe, expect, it } from 'vitest'
import { GRADE_LABEL, policyDashboard } from './policyDashboard'

// Guards the committed policy-bank summary: if a new run's file is copied in,
// these catch a schema change or a broken option before the UI renders it.
describe('policy dashboard data', () => {
  it('is the v1 schema with at least one briefed site', () => {
    expect(policyDashboard.schema).toBe('policy-dashboard/v1')
    expect(policyDashboard.sites.length).toBeGreaterThan(0)
  })

  it('gives every option a known grade, a next step and a quoted source', () => {
    for (const site of policyDashboard.sites) {
      expect(site.options.length).toBeGreaterThan(0)
      for (const o of site.options) {
        expect(Object.keys(GRADE_LABEL)).toContain(o.grade)
        expect(o.title && o.description && o.how_it_fits && o.limitations).toBeTruthy()
        expect(o.how_it_fits + o.limitations).not.toMatch(/\[\d+\]/)
        expect(o.next_step.length).toBeGreaterThan(0)
        expect(o.source.url).toMatch(/^https:\/\//)
        expect(o.source.quote.split(/\s+/).length).toBeLessThan(15)
        expect(o.patch_count).toBeLessThanOrEqual(site.patches.count)
      }
    }
  })

  it('keeps option ids unique so pins never collide', () => {
    const ids = policyDashboard.sites.flatMap((s) => s.options.map((o) => o.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries no coordinates', () => {
    expect(JSON.stringify(policyDashboard)).not.toMatch(/"(lat|lon|lng|x|y|geometry|coordinates)"/)
  })

  it('lists every scored site once, with the briefed ones marked', () => {
    const ids = policyDashboard.all_sites.map((s) => s.site_id)
    expect(new Set(ids).size).toBe(ids.length)
    const briefed = policyDashboard.all_sites.filter((s) => s.briefed).map((s) => s.site_id)
    expect(briefed.sort()).toEqual(policyDashboard.sites.map((s) => s.site_id).sort())
  })
})
