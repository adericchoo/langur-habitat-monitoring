import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import App from './App'
import StepPlaceholder from './pages/StepPlaceholder'
import SetRegionStep from './pages/SetRegionStep'
import HabitatLossStep from './pages/HabitatLossStep'
import FragmentationStep from './pages/FragmentationStep'
import HabitatRiskStep from './pages/HabitatRiskStep'
import PolicyStep from './pages/PolicyStep'
import ReportStep from './pages/ReportStep'
import Gallery from './pages/Gallery'
import { RegionProvider } from './regions/RegionContext'
import { STEPS } from './steps'

// Steps with a real page; everything else still renders the placeholder.
const BUILT = new Set(['habitat-loss', 'fragmentation', 'habitat-risk', 'policy', 'report'])

export const router = createBrowserRouter([
  {
    path: '/',
    // RegionProvider wraps BOTH Step Zero and the analysis shell, so the active
    // region is shared across every step (chip, gating, map spotlight).
    element: (
      <RegionProvider>
        <Outlet />
      </RegionProvider>
    ),
    children: [
      { index: true, element: <Navigate to="set-region" replace /> },
      // Step Zero is its own screen (basemap-only map + region panel), not the
      // analysis shell.
      { path: 'set-region', element: <SetRegionStep /> },
      // Analysis steps 01–05 share the App shell (top bar + analysis map + sidebar).
      {
        element: <App />,
        children: [
          { path: 'habitat-loss', element: <HabitatLossStep /> },
          { path: 'fragmentation', element: <FragmentationStep /> },
          { path: 'habitat-risk', element: <HabitatRiskStep /> },
          { path: 'policy', element: <PolicyStep /> },
          { path: 'report', element: <ReportStep /> },
          ...STEPS.filter((step) => step.slug !== 'set-region' && !BUILT.has(step.slug)).map((step) => ({
            path: step.slug,
            element: <StepPlaceholder />,
          })),
        ],
      },
    ],
  },
  // Isolated component gallery (C3) — standalone, outside the app shell.
  { path: '/gallery', element: <Gallery /> },
])
