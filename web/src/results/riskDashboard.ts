import type { ConfidenceInfo, RiskDimension, RiskSite } from '../types/risk'
import raw from './risk-dashboard-2025.json'

/**
 * Habitat-risk results from the real 2017 → 2025 run, per site. Written by
 * pipeline/priority-scoring/risk_summary.py from the priority scorer's output:
 * each site is read through its most urgent patch, whose four dimension reads,
 * priority and tier become the card's dimensions, score and band. Copy a new
 * run's outputs/risk-dashboard.json over risk-dashboard-2025.json to update.
 *
 * Screening output. No coordinates or geometry (SECURITY.md); confidence is
 * reported separately from the score, so a low-confidence site is flagged
 * "verify first", never demoted.
 */
interface RawDimension {
  key: RiskDimension['key']
  label: string
  weight: number
  score: number | null
  sentence: string
}

interface RawSite {
  site_id: string
  site_name: string
  patches: number
  priority: number
  action: 'act' | 'survey_gap' | 'watch' | 'log'
  why: string
  score: number
  band: RiskSite['band']
  tier: string
  confidence: {
    score: number
    label: ConfidenceInfo['label']
    present: number
    total: number
    missing: string[]
    verify_first: boolean
  }
  dimensions: RawDimension[]
}

export interface RiskDashboard {
  schema: string
  run_year: string
  earliest_change_year: string | null
  weights_elicited: boolean
  scoring_config_version: string
  sites: RawSite[]
}

export const riskDashboard = raw as RiskDashboard

/** The run's sites in the Step-03 view shape, highest risk first. */
export const riskSites: RiskSite[] = riskDashboard.sites.map((s) => ({
  id: s.site_id,
  name: s.site_name,
  sample: false,
  score: s.score,
  band: s.band,
  confidence: {
    score: s.confidence.score,
    label: s.confidence.label,
    present: s.confidence.present,
    total: s.confidence.total,
    missing: s.confidence.missing,
    verifyFirst: s.confidence.verify_first,
  },
  pinned: false,
  dimensions: s.dimensions.map((d) => ({ ...d, score: d.score ?? 0 })),
  priority: s.priority,
  action: s.action,
  why: s.why,
  patches: s.patches,
}))

/** The site's triage action, in plain words. */
export const ACTION_LABEL: Record<NonNullable<RiskSite['action']>, string> = {
  act: 'Act now',
  survey_gap: 'Survey langurs first',
  watch: 'Check on next visit',
  log: 'Keep on record',
}

/** True when the dimension weights are still provisional (not yet elicited). */
export const weightsProvisional = !riskDashboard.weights_elicited

