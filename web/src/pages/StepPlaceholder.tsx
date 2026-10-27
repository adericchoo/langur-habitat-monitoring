import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { STEPS } from '../steps'

// Placeholder sidebar for steps not yet built. Wrapped in <Sidebar> so every
// step shares the same chrome; real content arrives in later build blocks.
export default function StepPlaceholder() {
  const slug = useLocation().pathname.replace(/^\//, '')
  const step = STEPS.find((s) => s.slug === slug)

  return (
    <Sidebar
      eyebrow="Northern Vietnam · Kim Bang"
      title={step?.label ?? 'Step'}
      subtitle="placeholder — coming soon"
    >
      <p className="text-sm text-secondary">
        Real content for this step arrives in a later build block. Screening-grade data only.
      </p>
    </Sidebar>
  )
}
