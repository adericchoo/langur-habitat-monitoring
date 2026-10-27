export interface MapColors {
  habitat: string
  loss: string
  partial: string
  threat: string
  boundary: string
}

// Documented fallbacks (mirror design-tokens.css) for when the CSS vars can't
// be read — e.g. during tests. The DOM values win at runtime.
const FALLBACK: MapColors = {
  habitat: '#2E7D5B',
  loss: '#C65A3A',
  partial: '#E0A43B',
  threat: '#9E4A2E',
  boundary: '#18144B',
}

/**
 * Resolves the --map-* design tokens so MapLibre paint stays in sync with the
 * token source of truth (MapLibre paint takes colour strings, not Tailwind
 * classes). Reads the computed CSS variables off :root.
 */
export function getMapColors(): MapColors {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
    return FALLBACK
  }
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    habitat: read('--map-habitat', FALLBACK.habitat),
    loss: read('--map-loss', FALLBACK.loss),
    partial: read('--map-partial', FALLBACK.partial),
    threat: read('--map-threat', FALLBACK.threat),
    boundary: read('--map-boundary', FALLBACK.boundary),
  }
}
