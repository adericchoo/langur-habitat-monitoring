import { describe, expect, it } from 'vitest'
import { scopeDriverBlobs } from './useDrivers'
import { driverBlobsSample } from '../samples/drivers'
import type { Region } from '../regions/registry'

const sample = driverBlobsSample.features
const region = (id: string, kind: Region['kind']): Region => ({ id, name: id, kind })

describe('scopeDriverBlobs', () => {
  it('overall shows every blob (whole landscape)', () => {
    expect(scopeDriverBlobs(sample, region('overall', 'overall'))).toHaveLength(sample.length)
  })

  it('a predefined region shows only its attributed blobs', () => {
    const kb = scopeDriverBlobs(sample, region('kim-bang', 'predefined'))
    expect(kb.length).toBeGreaterThan(0)
    expect(kb.every((b) => b.properties.regionId === 'kim-bang')).toBe(true)
  })

  it('a region with no blobs is empty (exercises the empty state)', () => {
    expect(scopeDriverBlobs(sample, region('pu-luong', 'predefined'))).toHaveLength(0)
  })

  it('outside / custom / null show nothing (no blobs tagged to them)', () => {
    expect(scopeDriverBlobs(sample, region('outside', 'outside'))).toHaveLength(0)
    expect(scopeDriverBlobs(sample, region('x', 'custom'))).toHaveLength(0)
    expect(scopeDriverBlobs(sample, null)).toHaveLength(0)
  })
})

describe('driver sample integrity', () => {
  it('covers both drivers with valid confidence + the verified seam off', () => {
    const kinds = new Set(sample.map((b) => b.properties.driver))
    expect(kinds).toEqual(new Set(['quarry', 'agriculture']))
    for (const b of sample) {
      expect(['High', 'Moderate', 'Low']).toContain(b.properties.confidence.label)
      expect(b.properties.confidence.score).toBeGreaterThanOrEqual(0)
      expect(b.properties.confidence.score).toBeLessThanOrEqual(1)
      expect(b.properties.verified).toBe(false)
    }
  })

  it('includes a sub-threshold blob to exercise the declutter filter', () => {
    expect(sample.some((b) => b.properties.areaHa < 25)).toBe(true)
  })
})
