import { useLocation } from 'react-router-dom'
import { STEPS } from '../steps'

// C1 placeholder sidebar content. Each step gets its real cards/boxes in the
// D–H blocks (BUILD_CHECKLIST.md). Screening-grade language only — never
// "confirmed" / "detected".
export default function StepPlaceholder() {
  const slug = useLocation().pathname.replace(/^\//, '')
  const step = STEPS.find((s) => s.slug === slug)

  return (
    <div>
      <p
        style={{
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontSize: 12,
          color: '#6b7280',
          margin: 0,
        }}
      >
        Step
      </p>
      <h1 style={{ margin: '4px 0 8px', fontSize: 22 }}>
        {step?.label ?? 'Unknown step'}
      </h1>
      <p style={{ color: '#6b7280', margin: 0 }}>
        Placeholder sidebar — real content arrives in a later build block.
      </p>
    </div>
  )
}
