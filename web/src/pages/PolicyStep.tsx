import { useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import PolicyBox from '../components/PolicyBox'
import { policyBank, type PolicyDriver, type PolicyIntervention } from '../samples/policyBank'

// Driver groups, in display order, with a human heading.
const DRIVER_GROUPS: { driver: PolicyDriver; label: string }[] = [
  { driver: 'mining', label: 'Mining' },
  { driver: 'farming', label: 'Farming' },
  { driver: 'other', label: 'Other' },
]

/** Step 04 — Policy. Policy-brief boxes from the curated bank, grouped by the
 *  loss driver each addresses. G1 shows the whole bank; G2 will match it to the
 *  drivers actually detected. Pins are local to this step for G1 (H1 lifts them). */
export default function PolicyStep() {
  const [pins, setPins] = useState<Record<string, boolean>>({})
  const togglePin = (id: string) => setPins((prev) => ({ ...prev, [id]: !prev[id] }))
  const pinnedCount = useMemo(() => Object.values(pins).filter(Boolean).length, [pins])

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title="Policy"
      subtitle="interventions by driver · sample bank"
      headerAction={
        <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          Report · {pinnedCount} pinned
        </span>
      }
    >
      <div className="space-y-5">
        {DRIVER_GROUPS.map((group) => {
          const items = policyBank.filter((p) => p.driver === group.driver)
          if (items.length === 0) return null
          return (
            <section key={group.driver} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {group.label}
              </h2>
              {items.map((policy: PolicyIntervention) => (
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
        Pinned interventions carry into Step 05 · Report. Illustrative sample bank —
        to be curated with SVW / legal input.
      </p>
    </Sidebar>
  )
}
