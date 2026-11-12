import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import MapStage from './components/MapStage'
import CompareMap from './components/CompareMap'
import Stepper from './components/Stepper'
import { PinProvider } from './report/pins'
import { CompareProvider, useCompare } from './compare/CompareContext'
import { STEPS } from './steps'
import logoUrl from './Assets/Logo Suite_Ai for Good_edited.png'

/** Shared via Outlet context: the display year a step (currently Habitat loss)
 *  sets, which MapStage snaps to the nearest basemap. Compare-years state is a
 *  separate context (useCompare), read directly by the shell and the sidebar. */
export interface MapYearContext {
  mapYear: number
  setMapYear: (year: number) => void
}

// App shell: map (left), the active step's sidebar (right, via Outlet), and the
// full-width Stepper footer. The step content and highlighted map layer change;
// the shell stays put.
export default function App() {
  return (
    <PinProvider>
      <CompareProvider>
        <AppShell />
      </CompareProvider>
    </PinProvider>
  )
}

function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeSlug = pathname.replace(/^\//, '') || STEPS[0].slug

  // Default to the latest year; the Habitat loss step's year selector updates it.
  const [mapYear, setMapYear] = useState(2025)
  // Compare mode swaps the single-year map for the split map; single-year mode is
  // the untouched default.
  const { compareOn, baselineYear, currentYear } = useCompare()

  const logo = <img src={logoUrl} alt="AI for Good" className="h-6 w-auto" />

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          {compareOn ? (
            <CompareMap baselineYear={baselineYear} currentYear={currentYear} />
          ) : (
            <MapStage activeStep={activeSlug} year={mapYear} />
          )}
        </main>
        <div className="w-[380px] shrink-0 border-l border-brd">
          <Outlet context={{ mapYear, setMapYear } satisfies MapYearContext} />
        </div>
      </div>
      <Stepper
        steps={STEPS}
        activeSlug={activeSlug}
        onSelect={(slug) => navigate('/' + slug)}
        logo={logo}
      />
    </div>
  )
}
