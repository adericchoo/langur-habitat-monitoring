import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import StepPlaceholder from './pages/StepPlaceholder'
import Gallery from './pages/Gallery'
import { STEPS } from './steps'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to={STEPS[0].slug} replace /> },
      ...STEPS.map((step) => ({
        path: step.slug,
        element: <StepPlaceholder />,
      })),
    ],
  },
  // Isolated component gallery (C3) — standalone, outside the app shell.
  { path: '/gallery', element: <Gallery /> },
])
