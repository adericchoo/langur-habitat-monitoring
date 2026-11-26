import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'

/**
 * DEV-ONLY habitat-patch overlay data (Part A output; see corridor-method.md).
 *
 * The GeoJSON is PRECISE HABITAT GEOMETRY — the sensitive tier — so it is never
 * bundled or committed. It is served only from web/public/dev/ (gitignored) and
 * fetched here ONLY in a dev build. In production `import.meta.env.DEV` is false,
 * the effect returns immediately, and nothing is requested or shipped.
 *
 * Returns null until loaded (or always, in production / if the file is absent —
 * regenerate it with scratchpad make_patch_geojson.py into web/public/dev/).
 */
export function useDevPatches(): FeatureCollection | null {
  const [data, setData] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let alive = true
    fetch('/dev/habitat_patches_2025.geojson')
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
