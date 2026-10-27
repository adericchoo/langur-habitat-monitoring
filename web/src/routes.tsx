import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import StepPlaceholder from './pages/StepPlaceholder'
import HabitatLossStep from './pages/HabitatLossStep'
import FragmentationStep from './pages/FragmentationStep'
import HabitatRiskStep from './pages/HabitatRiskStep'
import PolicyStep from './pages/PolicyStep'
import ReportStep from './pages/ReportStep'
import Gallery from './pages/Gallery'
import { STEPS } from './steps'

// Steps with a real page; everything else still renders the placeholder.
const BUILT = new Set(['habitat-loss', 'fragmentation', 'habitat-risk', 'policy', 'report'])

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to={STEPS[0].slug} replace /> },
      { path: 'habitat-loss', element: <HabitatLossStep /> },
      { path: 'fragmentation', element: <FragmentationStep /> },
      { path: 'habitat-risk', element: <HabitatRiskStep /> },
      { path: 'policy', element: <PolicyStep /> },
      { path: 'report', element: <ReportStep /> },
      ...STEPS.filter((step) => !BUILT.has(step.slug)).map((step) => ({
        path: step.slug,
        element: <StepPlaceholder />,
      })),
    ],
  },
  // Isolated component gallery (C3) — standalone, outside the app shell.
  { path: '/gallery', element: <Gallery /> },
])
