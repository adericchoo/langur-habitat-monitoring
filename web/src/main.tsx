import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
// Self-hosted Montserrat (no external CDN request). Weights: regular → bold.
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
// Design tokens (CSS variables) must load once, before the Tailwind layers.
import './styles/design-tokens.css'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
