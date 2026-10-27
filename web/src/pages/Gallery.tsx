import { useState } from 'react'
import type { ReactNode } from 'react'
import Stepper from '../components/Stepper'
import Sidebar from '../components/Sidebar'
import MetricCard from '../components/MetricCard'
import PolicyBox from '../components/PolicyBox'
import ReportGroup from '../components/ReportGroup'
import { STEPS } from '../steps'
import logoUrl from '../Assets/Logo Suite_Ai for Good_edited.png'

/**
 * C3 component gallery (Storybook-ish). Renders every presentational component
 * in its variants with sample props. NOT the live app — reachable at /gallery.
 * All figures here are illustrative/screening-grade placeholders.
 */
export default function Gallery() {
  const [active, setActive] = useState(STEPS[0].slug)
  const [pins, setPins] = useState<Record<string, boolean>>({ lost: true, policyA: true })
  const toggle = (key: string) => setPins((prev) => ({ ...prev, [key]: !prev[key] }))

  const logo = <img src={logoUrl} alt="AI for Good" className="h-6 w-auto" />

  return (
    <div className="min-h-full bg-offwhite font-sans text-ink">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-navy">Component gallery</h1>
        <p className="mt-1 text-sm text-secondary">
          C3 presentational components — props only, token-driven. Not the live app.
        </p>

        <GallerySection title="MetricCard">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              variant="featured"
              label="Habitat remaining"
              value="12,480"
              unit="ha"
              caption="71% of 2000"
              pinned={!!pins.remaining}
              onTogglePin={() => toggle('remaining')}
            />
            <MetricCard
              label="Lost since 2000"
              value="5,120"
              unit="ha"
              delta="−29% of 2000"
              trend="up"
              pinned={!!pins.lost}
              onTogglePin={() => toggle('lost')}
            />
            <MetricCard
              variant="accent"
              label="Loss rate"
              value="1.3"
              unit="%/yr"
              delta="accelerating"
              trend="up"
              pinned={!!pins.rate}
              onTogglePin={() => toggle('rate')}
            />
            <MetricCard
              label="Active threats"
              value="5"
              unit="flagged"
              caption="3 verified · 2 auto (screening)"
              pinned={!!pins.threats}
              onTogglePin={() => toggle('threats')}
            />
          </div>
        </GallerySection>

        <GallerySection title="Sidebar">
          <div className="h-80 overflow-hidden rounded-card border border-brd">
            <Sidebar
              eyebrow="Northern Vietnam · Kim Bang"
              title="Habitat loss"
              subtitle="overall status · 2000–2026"
              headerAction={
                <span className="rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
                  Report · 1 pinned
                </span>
              }
            >
              <div className="space-y-3">
                <MetricCard
                  variant="featured"
                  label="Habitat remaining"
                  value="12,480"
                  unit="ha"
                  caption="71% of 2000"
                />
                <MetricCard
                  label="Lost since 2000"
                  value="5,120"
                  unit="ha"
                  delta="−29% of 2000"
                  trend="up"
                  pinned
                />
              </div>
            </Sidebar>
          </div>
        </GallerySection>

        <GallerySection title="PolicyBox">
          <PolicyBox
            name="Quarry buffer enforcement"
            country="Vietnam"
            description="Suspected clearing near the western corridor suggests tightening buffer enforcement around registered quarries."
            source="Decree 156/2018/ND-CP"
            howItFits="Targets the mining driver (54% of screened loss) adjacent to intact karst."
            limitations="Screening-grade; quarry extent is modelled, not field-verified."
            pinned={!!pins.policyA}
            onTogglePin={() => toggle('policyA')}
          />
        </GallerySection>

        <GallerySection title="ReportGroup">
          <ReportGroup
            title="Habitat loss"
            items={[
              { label: 'Habitat remaining', value: '12,480 ha' },
              { label: 'Lost since 2000', value: '5,120 ha' },
              { label: 'Loss rate', value: '1.3 %/yr' },
            ]}
          />
        </GallerySection>

        <GallerySection title="Stepper">
          <Stepper steps={STEPS} activeSlug={active} onSelect={setActive} logo={logo} />
        </GallerySection>
      </div>
    </div>
  )
}

function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary">
        {title}
      </h2>
      {children}
    </section>
  )
}
