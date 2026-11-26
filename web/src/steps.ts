export interface Step {
  slug: string
  label: string
}

// The user journey (see web/CLAUDE.md). Order is the product flow; the Stepper
// numbers these from 00. Step Zero (Set region) precedes the five analysis steps
// and gates them — nothing downstream is usable until a region is set.
export const STEPS: Step[] = [
  { slug: 'set-region', label: 'Set region' },
  { slug: 'habitat-loss', label: 'Habitat loss' },
  { slug: 'fragmentation', label: 'Fragmentation' },
  { slug: 'habitat-risk', label: 'Habitat risk' },
  { slug: 'policy', label: 'Policy' },
  { slug: 'report', label: 'Report' },
]
