import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { DriverKind } from '../map/mapTokens'

/**
 * Driver-blob contract (Step 01 · Habitat loss — the spatial version of the
 * "loss by driver" sidebar). The pipeline groups driver pixels into blobs
 * (quarry / agriculture), attributes each to a region, and scores an auto
 * confidence; the frontend ONLY RENDERS the resulting GeoJSON — no client-side
 * clustering. Geometry is coarsened and never a real/fine-grained location
 * (SECURITY.md). See data-contract/gee-output-spec.md.
 */

export type ConfidenceLabel = 'High' | 'Moderate' | 'Low'

export interface DriverConfidenceInfo {
  /** 0–1 auto-confidence score. */
  score: number
  label: ConfidenceLabel
}

/** Per-blob properties carried on each GeoJSON feature. */
export interface DriverBlobProps {
  id: string
  driver: DriverKind
  /** Whole-object footprint extent (ha) — the full connected blob. */
  areaHa: number
  /** The part of the footprint INSIDE the attributed region's habitat polygon (ha)
   *  — the habitat-loss-relevant portion, distinct from the whole object. A quarry
   *  can be a large object whose rim is mostly outside the habitat. */
  regionAreaHa: number
  /** Growth over the window (ha), e.g. +38. */
  deltaHa: number
  /** [startYear, endYear]. */
  window: [number, number]
  confidence: DriverConfidenceInfo
  /** Always false for now — the seam for a future "verified = solid fill" state
   *  (verification needs auth; not built here). */
  verified: boolean
  /** Region this blob is attributed to (matches the registry region id). */
  regionId: string
}

export type DriverFeature = Feature<Polygon, DriverBlobProps>
export type DriverCollection = FeatureCollection<Polygon, DriverBlobProps>
