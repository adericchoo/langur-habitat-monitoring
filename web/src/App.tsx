import { NavLink, Outlet } from 'react-router-dom'
import MapStage from './components/MapStage'
import { STEPS } from './steps'

// C1 shell placeholder: map (left), sidebar slot (right), full-width stepper
// footer. The real Stepper / Sidebar components and design tokens land in C2/C3
// — the inline styles here are intentionally throwaway scaffolding.
export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <main style={{ flex: 1, minWidth: 0 }}>
          <MapStage />
        </main>
        <aside
          style={{
            width: 360,
            borderLeft: '1px solid #e5e7eb',
            overflowY: 'auto',
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </aside>
      </div>
      <footer
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        {STEPS.map((step, i) => (
          <NavLink
            key={step.slug}
            to={step.slug}
            style={({ isActive }) => ({
              padding: '6px 12px',
              borderRadius: 999,
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 400,
              background: isActive ? '#111827' : 'transparent',
              color: isActive ? '#ffffff' : '#111827',
            })}
          >
            {String(i + 1).padStart(2, '0')} · {step.label}
          </NavLink>
        ))}
      </footer>
    </div>
  )
}
