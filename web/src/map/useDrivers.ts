import { useEffect, useState } from 'react'
import type { DriverCollection, DriverFeature } from '../types/drivers'
import type { Region } from '../regions/registry'
import { driverBlobsSample } from '../samples/drivers'

/**
 * Driver-blob loader (B4 seam, mirrors useMetricSites): fetch the real, gitignored
 * GeoJSON from web/public/data/ at runtime; fall back to the synthetic sample until
 * it is staged, or on a missing file / parse error. The client only renders — no
 * grouping or clustering here.
 */
export type DriverStatus = 'loading' | 'ready' | 'stale' | 'error'

export interface DriversResult {
  status: DriverStatus
  blobs: DriverFeature[]
}

export function useDrivers(): DriversResult {
  const [state, setState] = useState<DriversResult>({ status: 'loading', blobs: [] })

  useEffect(() => {
    let alive = true
    fetch('/data/drivers.json')
      .then((r) => (r.ok ? (r.json() as Promise<DriverCollection>) : null))
      .then((json) => {
        if (!alive) return
        // Real data staged → ready. Expected-absent (404/empty) → the sample is the
        // intended fallback, still a clean "ready".
        const feats = json && Array.isArray(json.features) ? json.features : []
        setState({ status: 'ready', blobs: feats.length ? feats : driverBlobsSample.features })
      })
      .catch(() => {
        if (!alive) return
        // Network / parse error: show the sample as a stale fallback, or error if
        // even the sample is unexpectedly empty.
        const sample = driverBlobsSample.features
        setState({ status: sample.length ? 'stale' : 'error', blobs: sample })
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}

/**
 * Scope blobs to the active region (pure — unit-tested). Overall shows the whole
 * landscape; a predefined region shows blobs attributed to it; outside/custom show
 * only blobs explicitly tagged to them (none in the sample → empty state). One
 * active region at a time.
 */
export function scopeDriverBlobs(blobs: DriverFeature[], region: Region | null): DriverFeature[] {
  if (!region) return []
  if (region.kind === 'overall') return blobs
  return blobs.filter((b) => b.properties.regionId === region.id)
}
