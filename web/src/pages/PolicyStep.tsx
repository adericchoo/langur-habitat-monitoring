import { useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import PolicyBox from '../components/PolicyBox'
import { habitatLossSites } from '../samples/habitatLoss'
import { policyBank, type PolicyDriver } from '../samples/policyBank'

// Loss-driver metric (from the habitat-loss step) → policy-bank driver tag.
const DRIVER_METRIC: Record<string, PolicyDriver> = {
  driver_mining: 'mining',
  driver_farming: 'farming',
  driver_other: 'other',
}
const DRIVER_LABEL: Record<PolicyDriver, string> = {
  mining: 'Mining',
  farming: 'Farming',
  other: 'Other',
}

// A driver counts as "detected" if its share is above this. 0 = present-means-
// detected; what really counts as a driver is a domain call (SVW), not a UI one,
// so this stays 0 and is the single knob to change if a threshold is adopted.
const MIN_SHARE = 0

/** Step 04 — Policy matcher. Reads the selected site's loss drivers and maps each
 *  detected driver (share-ranked) to its interventions in the bank. G2 adds the
 *  matching on top of G1's catalogue. Pins local for now; H1 lifts them, and the
 *  per-step site selection becomes shared state then too. */
export default function PolicyStep() {
  const [siteId, setSiteId] = useState(habitatLossSites[0].id)
  const [pins, setPins] = useState<Record<string, boolean>>({})
  const togglePin = (id: string) => setPins((prev) => ({ ...prev, [id]: !prev[id] }))
  const pinnedCount = useMemo(() => Object.values(pins).filter(Boolean).length, [pins])

  const site = habitatLossSites.find((s) => s.id === siteId) ?? habitatLossSites[0]

  // Detected drivers for this site: present (> MIN_SHARE), strongest first.
  const detected = useMemo(
    () =>
      Object.entries(DRIVER_METRIC)
        .map(([metric, driver]) => ({
          driver,
          share: site.metrics.find((m) => m.metric === metric)?.value ?? 0,
        }))
        .filter((d) => d.share > MIN_SHARE)
        .sort((a, b) => b.share - a.share),
    [site],
  )

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Policy"
      subtitle="interventions matched to detected drivers · sample bank"
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {pinnedCount} pinned
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
          {habitatLossSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-5">
        {detected.map(({ driver, share }) => {
          const items = policyBank.filter((p) => p.driver === driver)
          if (items.length === 0) return null
          return (
            <section key={driver} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {DRIVER_LABEL[driver]} · {share}% of suspected loss
              </h2>
              {items.map((policy) => (
                <PolicyBox
                  key={policy.id}
                  name={policy.name}
                  country={policy.country}
                  description={policy.description}
                  source={policy.source}
                  howItFits={policy.howItFits}
                  limitations={policy.limitations}
                  pinned={!!pins[policy.id]}
                  onTogglePin={() => togglePin(policy.id)}
                />
              ))}
            </section>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-secondary">
        Pinned interventions carry into Step 05 · Report. Matched to screening
        drivers; illustrative sample bank — to be curated with SVW / legal input.
      </p>
    </Sidebar>
  )
}
