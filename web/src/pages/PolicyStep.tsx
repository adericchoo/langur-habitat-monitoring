import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import PolicyBox from '../components/PolicyBox'
import { usePins } from '../report/pins'
import { GRADE_LABEL, policyDashboard } from '../results/policyDashboard'
import type { PolicyOption } from '../types/policy'

// The policy bank's loss drivers, in the step's original order.
const DRIVERS = ['mining', 'farming', 'other'] as const
const DRIVER_LABEL: Record<string, string> = {
  mining: 'Mining',
  farming: 'Farming',
  other: 'Other',
}

const { sites } = policyDashboard

// Sites arrive ranked by their most urgent area, so position 0 is the site to
// address first.
const RANK = ['Most urgent site', '2nd most urgent site', '3rd most urgent site',
  '4th most urgent site', '5th most urgent site', '6th most urgent site', '7th most urgent site']

/** Priority tiers in plain words: "1 needs action now · 10 to check on the next field visit". */
const URGENCY: Record<string, [string, string]> = {
  P1: ['area needs action now', 'areas need action now'],
  P2: ['to check on the next field visit', 'to check on the next field visit'],
  P3: ['lower priority', 'lower priority'],
  unscored: ['not enough data to rank', 'not enough data to rank'],
}

function urgencyLine(byTier: Record<string, number>): string {
  return ['P1', 'P2', 'P3', 'unscored']
    .filter((tier) => byTier[tier])
    .map((tier) => `${byTier[tier]} ${URGENCY[tier][byTier[tier] === 1 ? 0 : 1]}`)
    .join(' · ')
}

/** "Applies to …" leads the fit text when an option covers only some of the
 *  site's areas (e.g. only those inside the reserve). */
function howItFits(option: PolicyOption, total: number): string {
  return option.patch_count < total
    ? `Applies to ${option.applies_to}. ${option.how_it_fits}`
    : option.how_it_fits
}

/** The condition(s) to settle before raising it. For a "needs groundwork"
 *  option the listed condition is the one that does NOT hold here, and the
 *  body says so, since the heading alone can't carry that. */
function nextStep(option: PolicyOption): string {
  const step = /[.?!]$/.test(option.next_step) ? option.next_step : `${option.next_step}.`
  const more =
    option.more_conditions > 0 ? ` (+${option.more_conditions} more in the full brief)` : ''
  const notMet = option.grade === 'groundwork' ? " That isn't the case here yet." : ''
  return `${step}${notMet}${more}`
}

/** Step 04 — Policy matcher. Reads the policy bank's results for the real run
 *  (pipeline/policy-bank → policy-dashboard.json): for each of the sites with
 *  the most urgent suspected areas, the interventions matched to the site's
 *  loss driver, each with what to check before raising it. The classifier
 *  only maps quarrying so far, which the note under the Site menu says; the
 *  farming and other sections appear once a run detects them. */
export default function PolicyStep() {
  const [siteId, setSiteId] = useState(sites[0].site_id)
  const { isPinned, toggle, count } = usePins()

  const site = sites.find((s) => s.site_id === siteId) ?? sites[0]
  const areas = site.patch_noun.replace(/patches$/, 'areas')

  return (
    <Sidebar
      eyebrow={`Northern Vietnam · ${site.site_name}`}
      title="Policy"
      subtitle={
        policyDashboard.earliest_change_year
          ? `Policy options for quarrying detected between ${policyDashboard.earliest_change_year} and ${policyDashboard.run_year}`
          : `Policy options for quarrying detected up to ${policyDashboard.run_year}`
      }
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {count} pinned
        </span>
      }
    >
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary">
          Site
        </span>
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm text-ink"
        >
          {sites.map((s, i) => (
            <option key={s.site_id} value={s.site_id}>
              {s.site_name} - {RANK[i]}
            </option>
          ))}
        </select>
      </label>

      <p className="mb-4 rounded-card bg-teal-tint px-3 py-2 text-xs text-navy">
        The policies here address mining only. The satellite analysis behind this page
        detects quarrying: places where forest or bare rock was dug out for quarries.
        Farming and other drivers of habitat loss fall outside what it can see.
      </p>

      <div className="space-y-5">
        {DRIVERS.map((driver) =>
          driver === site.driver ? (
            <section key={driver} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {DRIVER_LABEL[driver]} · {site.patches.count} {areas}
              </h2>
              <p className="text-xs text-secondary">{urgencyLine(site.patches.by_tier)}</p>
              {site.options.map((option) => {
                const id = `policy:${option.id}`
                return (
                  <PolicyBox
                    key={option.id}
                    name={option.title}
                    country={option.country}
                    description={option.description}
                    source={option.source.title}
                    sourceUrl={option.source.url}
                    howItFits={howItFits(option, site.patches.count)}
                    status={
                      // In place: the fit text already says what to check there.
                      option.grade === 'in_place'
                        ? undefined
                        : { label: GRADE_LABEL[option.grade], body: nextStep(option) }
                    }
                    limitations={option.limitations}
                    pinned={isPinned(id)}
                    onTogglePin={() =>
                      toggle({
                        id,
                        step: 'policy',
                        label: option.title,
                        detail: `${site.site_name} · ${option.country}`,
                      })
                    }
                  />
                )
              })}
            </section>
          ) : null,
        )}
      </div>

      <p className="mt-4 text-xs text-secondary">
        Pinned interventions carry into Step 05 · Report. Options are shown for the{' '}
        {sites.length} sites with the most urgent suspected areas.
      </p>
    </Sidebar>
  )
}
