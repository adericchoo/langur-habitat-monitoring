export interface Step {
  slug: string
  label: string
}

// The 5-step user journey (see web/CLAUDE.md). Order is the product flow.
export const STEPS: Step[] = [
  { slug: 'habitat-loss', label: 'Habitat loss' },
  { slug: 'fragmentation', label: 'Fragmentation' },
  { slug: 'habitat-risk', label: 'Habitat risk' },
  { slug: 'policy', label: 'Policy' },
  { slug: 'report', label: 'Report' },
]
