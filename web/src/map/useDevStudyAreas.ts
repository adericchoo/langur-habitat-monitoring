import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'

/**
 * DEV-ONLY study-area overlay data: the 7 analysis regions (a copy of
 * data/study_areas/habitat_areas.geojson, each MultiPolygon carrying `name` +
 * `area_ha`, in WGS84 — the same regions the metric dropdown uses).
 *
 * These are PRECISE analysis boundaries — the sensitive tier — so, like the patch
 * and corridor overlays, they are never bundled or committed. Served only from
 * web/public/dev/ (gitignored) and fetched here ONLY in a dev build. In production
 * `import.meta.env.DEV` is false, the effect returns immediately, and nothing is
 * requested or shipped.
 *
 * Returns null until loaded (or always, in production / if the file is absent —
 * recreate it with `cp data/study_areas/habitat_areas.geojson
 * web/public/dev/study_areas.geojson`).
 */
export function useDevStudyAreas(): FeatureCollection | null {
  const [data, setData] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let alive = true
    fetch('/dev/study_areas.geojson')
      .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
      .then((json) => {
        if (alive && json) setData(json)
      })
      .catch(() => {
        /* no dev file present — overlay simply stays off */
      })
    return () => {
      alive = false
    }
  }, [])

  return data
}
