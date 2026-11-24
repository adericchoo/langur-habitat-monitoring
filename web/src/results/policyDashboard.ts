import type { PolicyDashboard, PolicyGrade, TriageAction } from '../types/policy'
import raw from './policy-dashboard-2025.json'

/**
 * Policy-bank summary from the real 2017 → 2025 run (case bank 0.5). Written by
 * pipeline/policy-bank/dashboard.py; copy a new run's
 * outputs/policy-dashboard.json over policy-dashboard-2025.json to update it.
 *
 * Screening output, not yet reviewed by Save Vietnam's Wildlife. It holds site
 * names, counts and tiers only: no coordinates or geometry (see SECURITY.md).
 */
export const policyDashboard = raw as PolicyDashboard

/** Grade → chip text, the label before the next step, and chip style. Literal
 *  classes so Tailwind's scanner keeps them. Brand colours only (map tones are
 *  reserved for the map). */
export const GRADE: Record<PolicyGrade, { chip: string; next: string; cls: string }> = {
  in_place: { chip: 'In place · check it', next: 'Check', cls: 'bg-teal-tint text-teal' },
  ready: { chip: 'Ready to raise', next: 'Ready', cls: 'bg-teal text-card' },
  confirm: { chip: 'Confirm first', next: 'Confirm', cls: 'border border-navy-tint text-navy' },
  groundwork: {
    chip: 'Groundwork first',
    next: 'Not met here',
    cls: 'border border-dashed border-navy-tint text-secondary',
  },
}

export const ACTION_LABEL: Record<TriageAction, string> = {
  act: 'Act',
  survey_gap: 'Survey first',
  watch: 'Watch',
  log: 'Log',
}

/** "P1 · top priority 64.7" style tier line. */
export const TIER_LABEL: Record<string, string> = {
  P1: 'Top tier',
  P2: 'Middle tier',
  P3: 'Lowest tier',
}

/** Sentence-case a locator ("news article" → "News article"). */
export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
