import type { ReactNode } from 'react'

/**
 * The Habitat-loss step reports two land-cover layers stacked: FOREST (produced
 * now — the land-cover forest class, which is also the interim habitat proxy) and
 * HABITAT (the dedicated langur-habitat class, still pending from the pipeline).
 * Both are always visible; habitat renders <HabitatPending/> until real data
 * lands, at which point it fills the same way forest does.
 *
 * Frontend-only for D2: no pipeline/contract change yet. When the habitat class
 * ships, this metadata + a habitat data source are the wiring points.
 */
export const LAYER_META = {
  forest: { title: 'Forest', hint: 'land-cover forest class · interim habitat proxy' },
  habitat: { title: 'Habitat', hint: 'dedicated langur-habitat class · pending' },
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

/** Placeholder shown in the Habitat section until the pipeline emits the
 *  dedicated langur-habitat class. Screening-grade, intentionally empty. */
export function HabitatPending() {
  return (
    <div className="rounded-card border border-dashed border-brd bg-card px-4 py-6 text-center text-sm text-secondary">
      No habitat-loss data yet — the dedicated langur-habitat class is pending from the pipeline.
      Forest above is the interim proxy. Screening product, not confirmed loss.
    </div>
  )
}
