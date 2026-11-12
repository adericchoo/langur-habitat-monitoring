import type { RiskBand, RiskDimension, RiskSite } from '../types/risk'

/**
 * SAMPLE tier only — synthetic composite-risk figures shaped to the Step-03 view
 * model (types/risk.ts). Composite habitat risk is a 0–1 screening score and does
 * NOT exist upstream yet (see pipeline HANDOFF). Region NAMES are real, but every
 * score / band / confidence / sentence below is an illustrative PLACEHOLDER — not
 * a real measurement, location, or confirmed threat. The four TVEG sentences are
 * deliberately generic (no specific claims about real reserves) until the pipeline
 * emits per-region output; the B4 loader swaps these for real values. See SECURITY.md.
 * Lives under src/samples/ (not the gitignored `data/`).
 */

// The four TVEG dimensions — labels + provisional weights are fixed across
// regions; only the sentences differ once real output lands. Weights sum to 1.
const DIMENSION_DEFS: { key: RiskDimension['key']; label: string; weight: number }[] = [
  { key: 'threat', label: 'Threat activity', weight: 0.3 },
  { key: 'value', label: 'Habitat value at risk', weight: 0.3 },
  { key: 'exposure', label: 'Adjacent exposure', weight: 0.25 },
  { key: 'governance', label: 'Governance leverage', weight: 0.15 },
]

// Neutral, screening-safe placeholder copy per dimension — same for every region
// on purpose (these are not yet produced upstream; real per-region reads replace
// them via B4). No specific claims about any named reserve.
const PLACEHOLDER_SENTENCE: Record<RiskDimension['key'], string> = {
  threat:
    'Placeholder — screening read of recent threat activity (clearing, quarry edge) for this region; pending real pipeline output.',
  value:
    'Placeholder — screening read of habitat value at risk (patch size, canopy, langur likelihood) for this region; pending real pipeline output.',
  exposure:
    'Placeholder — screening read of adjacent exposure (corridor proximity, edge pressure) for this region; pending real pipeline output.',
  governance:
    'Placeholder — screening read of governance leverage (protected overlap, concession status, enforcement reach) for this region; pending real pipeline output.',
}

const dimensions = (): RiskDimension[] =>
  DIMENSION_DEFS.map((d) => ({ ...d, sentence: PLACEHOLDER_SENTENCE[d.key] }))

interface Seed {
  id: string
  name: string
  score: number
  band: RiskBand
  confidence: RiskSite['confidence']
}

// Region names are real (publicly-known karst / protected areas); scores/bands/confidence are
// placeholders. Confidence is varied, and kept INDEPENDENT of the score: the two
// high-score / lower-confidence sites (Huong Son, Kim Bang) carry verifyFirst,
// which flags "verify first" but never demotes the risk band.
const SEEDS: Seed[] = [
  { id: 'cuc-phuong', name: 'Cuc Phuong', score: 0.28, band: 'low', confidence: { score: 0.82, label: 'High', verifyFirst: false } },
  { id: 'pu-luong-karst', name: 'Pu Luong Karst', score: 0.46, band: 'med', confidence: { score: 0.6, label: 'Moderate', verifyFirst: false } },
  { id: 'hoa-lu-trang-an', name: 'Hoa Lu / Trang An', score: 0.54, band: 'med', confidence: { score: 0.55, label: 'Moderate', verifyFirst: false } },
  { id: 'huong-son-lac-thuy', name: 'Huong Son – Lac Thuy', score: 0.69, band: 'high', confidence: { score: 0.38, label: 'Low', verifyFirst: true } },
  { id: 'van-long-dong-tam', name: 'Van Long NR – Dong Tam', score: 0.58, band: 'med', confidence: { score: 0.64, label: 'Moderate', verifyFirst: false } },
  { id: 'tam-diep', name: 'Tam Diep Forest', score: 0.31, band: 'low', confidence: { score: 0.78, label: 'High', verifyFirst: false } },
  { id: 'kim-bang', name: 'Kim Bang', score: 0.74, band: 'high', confidence: { score: 0.52, label: 'Moderate', verifyFirst: true } },
]

export const habitatRiskSites: RiskSite[] = SEEDS.map((s) => ({
  ...s,
  sample: true,
  pinned: false,
  dimensions: dimensions(),
}))
