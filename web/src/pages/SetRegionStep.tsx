import { useNavigate } from 'react-router-dom'
import StepZeroMap from '../components/StepZeroMap'
import RegionPanel from '../components/RegionPanel'
import Stepper from '../components/Stepper'
import { STEPS } from '../steps'
import { useRegion } from '../regions/RegionContext'
import { toRegion } from '../regions/registry'
import logoUrl from '../Assets/Logo Suite_Ai for Good_edited.png'

/**
 * Step Zero · Set region — the screen that precedes steps 01–05. Map (left,
 * basemap-only) + region panel (right) + the shared Stepper footer. Selecting a
 * region lifts it into the shared RegionContext, which every downstream step reads
 * and which gates them until it is set.
 */
export default function SetRegionStep() {
  const navigate = useNavigate()
  const { activeRegion, setActiveRegion } = useRegion()

  // Analysis steps stay locked in the stepper until a region is set.
  const lockedSlugs = activeRegion ? [] : STEPS.filter((s) => s.slug !== 'set-region').map((s) => s.slug)

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <StepZeroMap />
        </main>
        <div className="w-[420px] shrink-0 border-l border-brd">
          <RegionPanel
            // Region identity is synchronous sample tier today; a loader will drive
            // loading/stale/error later (see RegionPanelStatus).
            status="ready"
            activeId={activeRegion?.id ?? null}
            onSelect={(option) => setActiveRegion(toRegion(option))}
            onContinue={() => navigate('/habitat-loss')}
          />
        </div>
      </div>
      <Stepper
        steps={STEPS}
        activeSlug="set-region"
        lockedSlugs={lockedSlugs}
        onSelect={(slug) => navigate('/' + slug)}
        logo={<img src={logoUrl} alt="AI for Good" className="h-6 w-auto" />}
      />
    </div>
  )
}
