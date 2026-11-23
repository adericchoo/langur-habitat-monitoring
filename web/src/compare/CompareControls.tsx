import { useLocation } from 'react-router-dom'
import { useCompareOptional, stepSupportsCompare } from './CompareContext'

/** The "Compare years" toggle + (when on) the Baseline/Current year selects.
 *  Rendered in the Sidebar's FIXED (non-scrolling) band, but only on the steps
 *  that support compare-years (Habitat loss, Fragmentation) — a two-epoch
 *  land-cover diff has no meaning on the other steps, so the toggle is hidden
 *  there (and the shell map stays single-year). Returns null outside a
 *  CompareProvider (e.g. the standalone /gallery route). Options are filtered so
 *  baseline is always < current and the same year can't be picked twice. */
export default function CompareControls() {
  const ctx = useCompareOptional()
  const { pathname } = useLocation()
  if (!ctx) return null
  if (!stepSupportsCompare(pathname.replace(/^\//, ''))) return null

  const {
    compareOn,
    setCompareOn,
    baselineYear,
    currentYear,
    setBaselineYear,
    setCurrentYear,
    availableYears,
  } = ctx

  const descending = [...availableYears].sort((a, b) => b - a)
  const baselineOptions = descending.filter((y) => y < currentYear)
  const currentOptions = descending.filter((y) => y > baselineYear)

  return (
    <div className="shrink-0 border-b border-brd bg-offwhite px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span id="compare-years-label" className="text-sm font-semibold text-navy">
          Compare years
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={compareOn}
          aria-labelledby="compare-years-label"
          onClick={() => setCompareOn(!compareOn)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
            compareOn ? 'bg-teal' : 'bg-navy-tint',
          ].join(' ')}
        >
          <span
            aria-hidden
            className={[
              'inline-block h-5 w-5 transform rounded-pill bg-card transition-transform',
              compareOn ? 'translate-x-5' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>
      </div>

      {compareOn && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <YearSelect
            label="Baseline"
            value={baselineYear}
            options={baselineOptions}
            onChange={setBaselineYear}
          />
          <YearSelect
            label="Current"
            value={currentYear}
            options={currentOptions}
            onChange={setCurrentYear}
          />
        </div>
      )}
    </div>
  )
}

function YearSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  onChange: (year: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-secondary">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} year`}
        className="w-full rounded-pill border border-brd bg-card px-3 py-1.5 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        {/* The selected value is always included so the control stays controlled
            even though it's filtered out of the opposite select's options. */}
        {!options.includes(value) && (
          <option key={value} value={value}>
            {value}
          </option>
        )}
        {options.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  )
}
