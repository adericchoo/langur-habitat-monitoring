import type { YearData } from '../compare/types'

/**
 * SAMPLE tier only — synthetic per-year snapshots shaped to the compare (D2)
 * view model. Screening-grade, illustrative, NOT real measurements or locations
 * (SECURITY.md). Replaced by the B4 typed loader + a real per-year time series.
 *
 * The series declines in forest area over time with rising pressure, and the
 * 2025 figures line up with the Habitat-loss "overall" sample for continuity.
 *
 * NOTE: the 2000 snapshot deliberately uses an older mask rule (`forest-mask-v1`)
 * so a 2000→later comparison exercises the "not directly comparable" guardrail.
 * 2010 onward share `forest-mask-v2`, so the default 2017→2025 pair is clean.
 */
const YEARS: YearData[] = [
  {
    year: 2000,
    maskRule: 'forest-mask-v1',
    layerRef: 'compare-layer-2000',
    remainingHa: 61200,
    coreHa: 52000,
    quarryHa: 120,
    driverSplit: { mining: 14, farming: 58, other: 28 },
    band: 'low',
    confidence: { score: 0.55, label: 'Moderate', verifyFirst: true },
  },
  {
    year: 2010,
    maskRule: 'forest-mask-v2',
    layerRef: 'compare-layer-2010',
    remainingHa: 59000,
    coreHa: 49500,
    quarryHa: 180,
    driverSplit: { mining: 19, farming: 54, other: 27 },
    band: 'low',
    confidence: { score: 0.62, label: 'Moderate', verifyFirst: false },
  },
  {
    year: 2017,
    maskRule: 'forest-mask-v2',
    layerRef: 'compare-layer-2017',
    remainingHa: 57600,
    coreHa: 48200,
    quarryHa: 240,
    driverSplit: { mining: 23, farming: 49, other: 28 },
    band: 'med',
    confidence: { score: 0.72, label: 'Moderate', verifyFirst: false },
  },
  {
    year: 2020,
    maskRule: 'forest-mask-v2',
    layerRef: 'compare-layer-2020',
    remainingHa: 56900,
    coreHa: 47600,
    quarryHa: 270,
    driverSplit: { mining: 26, farming: 46, other: 28 },
    band: 'med',
    confidence: { score: 0.78, label: 'High', verifyFirst: false },
  },
  {
    year: 2025,
    maskRule: 'forest-mask-v2',
    layerRef: 'compare-layer-2025',
    remainingHa: 55900,
    coreHa: 47200,
    quarryHa: 291,
    driverSplit: { mining: 23, farming: 49, other: 28 },
    band: 'high',
    confidence: { score: 0.83, label: 'High', verifyFirst: false },
  },
]

/** The sample years, newest first — the order the selects present them in. */
export const compareYearsData: YearData[] = [...YEARS].sort((a, b) => b.year - a.year)

/** Just the years present in the data (ascending), for building the selects. */
export const availableCompareYears: number[] = YEARS.map((y) => y.year).sort((a, b) => a - b)

/** Default pair (spec example): 2017 baseline → 2025 current. */
export const DEFAULT_BASELINE_YEAR = 2017
export const DEFAULT_CURRENT_YEAR = 2025

export function getYearData(year: number): YearData | undefined {
  return YEARS.find((y) => y.year === year)
}
