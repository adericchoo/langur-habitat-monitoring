import { useNavigate } from 'react-router-dom'
import { useRegion } from '../regions/RegionContext'

/**
 * Persistent top bar for steps 01–05: the active-region chip + an
 * "Add / change region" button that returns to Step Zero. One active region at a
 * time — switching replaces context, never combines. AIFG design tokens.
 */
export default function RegionTopBar() {
  const navigate = useNavigate()
  const { activeRegion } = useRegion()

  return (
    <div className="flex items-center justify-between gap-3 border-b border-brd bg-card px-4 py-2 font-sans">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Region
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-pill bg-teal-tint px-3 py-1 text-sm font-semibold text-navy">
          <span className="h-2 w-2 shrink-0 rounded-pill bg-teal" aria-hidden />
          <span className="truncate">{activeRegion?.name ?? 'No region set'}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate('/set-region')}
        className="shrink-0 rounded-pill px-3 py-1 text-sm font-semibold text-teal transition-colors hover:bg-teal-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        Add / change region
      </button>
    </div>
  )
}
