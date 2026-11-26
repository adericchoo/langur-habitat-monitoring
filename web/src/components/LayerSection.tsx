import type { ReactNode } from 'react'

/**
 * The Habitat-loss step reports two land-cover layers stacked: FOREST (the
 * plain-forest class, 1) and HABITAT (the karst-forest class, 2 = langur habitat).
 * Both are now produced by the pipeline (habitat_loss.py emits a `forest` and a
 * `habitat` track) and fill with real metrics in the single-year view.
 *
 * <HabitatPending/> below is still used by the compare-years dashboard, whose
 * two-year interval model has not yet been wired to the real tracks.
 */
export const LAYER_META = {
  forest: { title: 'Forest', hint: 'plain-forest class (land cover)' },
  habitat: { title: 'Habitat', hint: 'karst-forest class · langur habitat' },
} as const

export type HabitatLayer = keyof typeof LAYER_META

/** A titled layer block (Forest / Habitat) wrapping its metric content. */
export default function LayerSection({
  layer,
  children,
}: {
  layer: HabitatLayer
  children: ReactNode
}) {
  const meta = LAYER_META[layer]
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 border-b border-brd pb-1">
        <h2 className="text-sm font-bold text-navy">{meta.title}</h2>
        <span className="text-xs text-secondary">{meta.hint}</span>
      </div>
      {children}
    </section>
  )
}

/** Placeholder for the Habitat section of the compare-years dashboard, whose
 *  two-year interval model is not yet wired to the real habitat track. (The
 *  single-year view fills this section with real metrics.) */
export function HabitatPending() {
  return (
    <div className="rounded-card border border-dashed border-brd bg-card px-4 py-6 text-center text-sm text-secondary">
      Habitat comparison isn’t wired to the two-year view yet — switch off Compare years to see
      the karst-forest metrics. Screening product, not confirmed loss.
    </div>
  )
}
