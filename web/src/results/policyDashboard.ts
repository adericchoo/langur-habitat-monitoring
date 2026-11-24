import type { PolicyDashboard, PolicyGrade } from '../types/policy'
import raw from './policy-dashboard-2025.json'

/**
 * Policy-bank results from the real 2017 → 2025 run (case bank 0.5). Written by
 * pipeline/policy-bank/dashboard.py; copy a new run's
 * outputs/policy-dashboard.json over policy-dashboard-2025.json to update it.
 *
 * Screening output, not yet reviewed by Save Vietnam's Wildlife. It holds site
 * names, counts and tiers only: no coordinates or geometry (see SECURITY.md).
 */
export const policyDashboard = raw as PolicyDashboard

/** Grade → the heading of the card's "before raising it" section. */
export const GRADE_LABEL: Record<PolicyGrade, string> = {
  in_place: 'Already in place · next step',
  ready: 'Ready to raise now',
  confirm: 'Before raising it, confirm',
  groundwork: 'What has to be true first',
}
