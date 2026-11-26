import { describe, expect, it } from 'vitest'
import {
  REGIONS,
  SELECTABLE_OPTIONS,
  OVERALL_OPTION,
  OUTSIDE_OPTION,
  CUSTOM_OPTION,
  PREDEFINED_OPTIONS,
  regionByName,
  toRegion,
} from './registry'
import { BASEMAP_BOUNDS } from '../map/basemap'

describe('region registry', () => {
  it('has the 7 canonical regions with stable ids, names and areas', () => {
    expect(REGIONS).toHaveLength(7)
    for (const r of REGIONS) {
      expect(r.id).toMatch(/^[a-z0-9-]+$/) // slug-safe join key
      expect(r.name.length).toBeGreaterThan(0)
      expect(r.area_ha).toBeGreaterThan(0)
    }
    // ids are unique
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length)
  })

  it('orders selectable options overall → 7 predefined → outside', () => {
    expect(SELECTABLE_OPTIONS[0]).toBe(OVERALL_OPTION)
    expect(SELECTABLE_OPTIONS[SELECTABLE_OPTIONS.length - 1]).toBe(OUTSIDE_OPTION)
    expect(SELECTABLE_OPTIONS.filter((o) => o.kind === 'predefined')).toHaveLength(7)
    // custom is NOT selectable (rendered as a disabled stub)
    expect(SELECTABLE_OPTIONS).not.toContain(CUSTOM_OPTION)
    expect(CUSTOM_OPTION.disabled).toBe(true)
  })

  it('overall meta counts the regions; outside carries the magenta accent', () => {
    expect(OVERALL_OPTION.meta).toBe('7 regions')
    expect(OUTSIDE_OPTION.accent).toBe('magenta')
  })

  it('predefined options format the area as hectares', () => {
    const puLuong = PREDEFINED_OPTIONS.find((o) => o.id === 'pu-luong')
    expect(puLuong?.meta).toBe('12,409 ha')
  })

  it('regionByName matches the exact map-feature name', () => {
    expect(regionByName('Kim Bang')?.id).toBe('kim-bang')
    expect(regionByName('Huong Son – Lac Thuy')?.id).toBe('huong-son-lac-thuy') // en-dash
    expect(regionByName('nope')).toBeUndefined()
  })

  it('toRegion sets a bbox only for overall (the public basemap extent)', () => {
    expect(toRegion(OVERALL_OPTION).bbox).toEqual(BASEMAP_BOUNDS)
    expect(toRegion(PREDEFINED_OPTIONS[0]).bbox).toBeUndefined()
    expect(toRegion(OUTSIDE_OPTION).bbox).toBeUndefined()
  })
})
