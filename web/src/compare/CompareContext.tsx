import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  availableCompareYears,
  DEFAULT_BASELINE_YEAR,
  DEFAULT_CURRENT_YEAR,
} from '../samples/compareYears'

/** Shared "Compare years" (D2) state. Lifted to the app shell so the split map
 *  and the Habitat-loss sidebar react to the same mode + year pair. */
interface CompareStore {
  compareOn: boolean
  setCompareOn: (on: boolean) => void
  /** Always the earlier year of the pair. */
  baselineYear: number
  /** Always the later year of the pair. */
  currentYear: number
  /** Set one endpoint; the pair auto-orders (baseline < current) and never
   *  collapses to the same year. */
  setBaselineYear: (year: number) => void
  setCurrentYear: (year: number) => void
  /** Years present in the data (ascending) — the only selectable options. */
  availableYears: number[]
}

const CompareContext = createContext<CompareStore | null>(null)

/** Order a pair: distinct and ascending. If the two collapse to one year, nudge
 *  the second endpoint to its nearest different available year. */
function orderPair(a: number, b: number, years: number[]): [number, number] {
  let lo = a
  let hi = b
  if (lo === hi) {
    const alt =
      [...years].sort((y1, y2) => Math.abs(y1 - hi) - Math.abs(y2 - hi)).find((y) => y !== hi) ?? hi
    hi = alt
  }
  return lo <= hi ? [lo, hi] : [hi, lo]
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareOn, setCompareOn] = useState(false)
  const [[baselineYear, currentYear], setPair] = useState<[number, number]>(() =>
    orderPair(DEFAULT_BASELINE_YEAR, DEFAULT_CURRENT_YEAR, availableCompareYears),
  )

  const setBaselineYear = useCallback(
    (year: number) => setPair(([, cur]) => orderPair(year, cur, availableCompareYears)),
    [],
  )
  const setCurrentYear = useCallback(
    (year: number) => setPair(([base]) => orderPair(base, year, availableCompareYears)),
    [],
  )

  const value = useMemo<CompareStore>(
    () => ({
      compareOn,
      setCompareOn,
      baselineYear,
      currentYear,
      setBaselineYear,
      setCurrentYear,
      availableYears: availableCompareYears,
    }),
    [compareOn, baselineYear, currentYear, setBaselineYear, setCurrentYear],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

/** Access the shared compare store. Throws if used outside a CompareProvider. */
export function useCompare(): CompareStore {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within a CompareProvider')
  return ctx
}
