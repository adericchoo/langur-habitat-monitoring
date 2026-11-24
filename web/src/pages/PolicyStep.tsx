import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import PolicyOptionCard from '../components/PolicyOptionCard'
import { usePins } from '../report/pins'
import { ACTION_LABEL, GRADE, TIER_LABEL, policyDashboard } from '../results/policyDashboard'
import type { PolicySite } from '../types/policy'

const { sites, run, not_briefed: notBriefed } = policyDashboard

/** Step 04 — Policy. Reads the policy bank's compact summary of the real run:
 *  the sites with the highest-priority patches, each with the few options the
 *  plain-English overview names. The full reasoning, every condition and every
 *  source live in the per-site briefs; this step is the short version. */
export default function PolicyStep() {
  const [siteId, setSiteId] = useState(sites[0].site_id)
  const [showSummary, setShowSummary] = useState(false)
  const { isPinned, toggle, count } = usePins()

  const site = sites.find((s) => s.site_id === siteId) ?? sites[0]

  return (
    <Sidebar
      eyebrow={`Northern Vietnam · ${site.site_name}`}
      title="Policy"
      subtitle={`options for the highest-priority sites · ${policyDashboard.run_year} run`}
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {count} pinned
        </span>
      }
    >
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary">
          Site · {sites.length} of {run.sites} briefed
        </span>
        <select
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value)
            setShowSummary(false)
          }}
          className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm text-ink"
        >
          {sites.map((s) => (
            <option key={s.site_id} value={s.site_id}>
              {s.site_name} · {s.top_tier} · {s.top_priority}
            </option>
          ))}
        </select>
      </label>

      <SiteHeadline site={site} />

      <button
        type="button"
        onClick={() => setShowSummary((v) => !v)}
        aria-expanded={showSummary}
        className="mt-2 flex items-center gap-1 rounded-md text-xs font-semibold text-navy hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        <span
          aria-hidden="true"
          className={`inline-block text-secondary transition-transform ${showSummary ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        Read the summary
      </button>
      {showSummary ? <p className="mt-2 text-sm leading-relaxed text-ink">{site.summary}</p> : null}

      <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-secondary">
        Options to raise · {site.options.length}
      </h2>
      <div className="space-y-3">
        {site.options.map((option) => {
          const id = `policy:${option.id}`
          return (
            <PolicyOptionCard
              key={option.id}
              option={option}
              pinned={isPinned(id)}
              onTogglePin={() =>
                toggle({
                  id,
                  step: 'policy',
                  label: option.name,
                  detail: `${site.site_name} · ${GRADE[option.grade].chip}`,
                })
              }
            />
          )
        })}
      </div>

      <div className="mt-5 space-y-2 border-t border-brd pt-3 text-xs text-secondary">
        <p>
          Every condition and source is in the full brief ({site.brief}). Not briefed this run:{' '}
          {notBriefed.sites.join(', ')} ({notBriefed.patches} patches).
        </p>
        <p>{policyDashboard.caveat}</p>
      </div>
    </Sidebar>
  )
}

/** Navy headline card: the site's patch count, area, tiers and triage action. */
function SiteHeadline({ site }: { site: PolicySite }) {
  const tiers = Object.entries(site.patches.by_tier)
    .map(([tier, n]) => `${n} ${tier}`)
    .join(' · ')
  return (
    <div className="rounded-card bg-navy p-4 font-sans">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal">
          {TIER_LABEL[site.top_tier] ?? site.top_tier} · priority {site.top_priority}
        </p>
        <span className="shrink-0 rounded-pill bg-card px-2.5 py-0.5 text-xs font-semibold text-navy">
          {ACTION_LABEL[site.action]}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold leading-tight text-card">
        {site.patches.count}
        <span className="ml-1.5 text-base font-semibold">{site.patch_noun}</span>
      </p>
      <p className="mt-1 text-xs text-teal-tint">
        {site.patches.area_ha !== null ? `${site.patches.area_ha} ha · ` : ''}
        {tiers}
      </p>
    </div>
  )
}
