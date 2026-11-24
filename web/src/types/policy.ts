/**
 * Shape of policy-dashboard.json (schema "policy-dashboard/v1"), written by
 * pipeline/policy-bank/dashboard.py. A compact copy of the policy briefs for
 * the Policy step: per briefed site, the headline numbers and the few options
 * the plain-English overview names. Every string comes from the briefs.
 */

/** How ready an option is at this site. Matches the policy bank's grades. */
export type PolicyGrade = 'in_place' | 'ready' | 'confirm' | 'groundwork'

/** The site's most urgent triage action from the priority scorer. */
export type TriageAction = 'act' | 'survey_gap' | 'watch' | 'log'

export interface PolicySource {
  title: string
  url: string
  /** Where in the source the quote sits, e.g. "Article 26(1)(c)". */
  locator: string
  /** Verbatim English, under 15 words. */
  quote: string
  checked: string
}

export interface PolicyOption {
  /** Unique per site: "<site_id>:<case_id>". */
  id: string
  case_id: string
  kind: 'instrument' | 'precedent'
  country: string
  name: string
  /** The case's formal name, shown as the card title. */
  title: string
  /** What the law or measure is. */
  description: string
  /** Why it fits these areas (worded conditionally when an attribute is unknown). */
  how_it_fits: string
  limitations: string
  /** One sentence: what raising it would do, or that it is already in place. */
  does: string
  grade: PolicyGrade
  /** The one thing to do or check next (wording depends on the grade). */
  next_step: string
  /** Further conditions listed in the full brief. */
  more_conditions: number
  patch_count: number
  /** "All 42 patches", or which groups of patches it covers. */
  applies_to: string
  source: PolicySource
  reviewed_by_svw: boolean
}

export interface PolicySite {
  site_id: string
  site_name: string
  /** Loss driver behind most of the site's areas: "mining", "farming" or "other". */
  driver: string
  action: TriageAction
  brief_type: string
  top_priority: number
  top_tier: string
  /** e.g. "suspected quarry patches". */
  patch_noun: string
  patches: { count: number; area_ha: number | null; by_tier: Record<string, number> }
  /** The site's plain-English overview paragraph, without links. */
  summary: string
  options: PolicyOption[]
  /** Path of the full brief, relative to the policy bank's outputs folder. */
  brief: string
}

/** Every scored site, briefed or not. */
export interface PolicyRunSite {
  site_id: string
  site_name: string
  briefed: boolean
  patches: number
  by_tier: Record<string, number>
  top_priority: number | null
  top_tier: string
}

export interface PolicyDashboard {
  schema: 'policy-dashboard/v1'
  run_year: string
  /** Earliest year a flagged change is dated to (the earlier image's year). */
  earliest_change_year: string | null
  caveat: string
  bank_version: string
  run: { patches: number; sites: number; by_tier: Record<string, number> }
  sites: PolicySite[]
  all_sites: PolicyRunSite[]
  not_briefed: { patches: number; sites: string[] }
}
