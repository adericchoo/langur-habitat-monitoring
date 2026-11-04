// Step 03 — Habitat risk VIEW types.
//
// These are richer than the CSV summary contract (SummaryMetric/MetricSite in
// contract.ts): composite habitat risk does NOT exist upstream yet (see pipeline
// HANDOFF), so the whole Step-03 model is sample/mock, shaped for the UI the
// Figma risk card describes. When the pipeline emits real per-region risk, the
// B4 loader maps it into these types. Screening-grade — a 0–1 likelihood, never
// a confirmed threat (SECURITY.md).

import type { RiskLevel } from './contract'

/** Risk class. Same three values the map paint + RiskBadge key on. */
export type RiskBand = RiskLevel

/** One of the four TVEG risk dimensions the composite is built from. */
export interface RiskDimension {
  key: 'threat' | 'value' | 'exposure' | 'governance'
  /** Uppercase display label, e.g. "THREAT ACTIVITY". */
  label: string
  /** Provisional weight (0–1); the four sum to 1. Shown as a "w 0.30" tag. */
  weight: number
  /** One screening-grade sentence for this dimension. */
  sentence: string
}

/** Confidence in the screening read — kept SEPARATE from the risk score. A
 *  high-score / low-confidence site is flagged "verify first", never demoted. */
export interface ConfidenceInfo {
  /** 0–1 confidence score. */
  score: number
  label: 'High' | 'Moderate' | 'Low'
  /** When true, show a "verify first" tag; does NOT lower the risk score. */
  verifyFirst: boolean
}

/** A site with its composite risk + the four dimensions that compose it. */
export interface RiskSite {
  id: string
  name: string
  /** Sample/mock, not a real measurement — drives the "(sample)" affordances. */
  sample: boolean
  /** 0–1 composite (geometric mean of the four dimension reads). */
  score: number
  band: RiskBand
  confidence: ConfidenceInfo
  /** Initial pinned flag; the live pinned state comes from the shared pin store. */
  pinned: boolean
  /** The four TVEG dimensions, in display order (threat → value → exposure → governance). */
  dimensions: RiskDimension[]
}

/** Load states the panel can render. Real async states arrive with the B4
 *  loader; until then the hook returns `ready` with sample data (and `empty`
 *  when a region filter matches nothing). */
export type RiskLoadState = 'loading' | 'empty' | 'stale' | 'error' | 'ready'
