import type { Map as MaplibreMap } from 'maplibre-gl'

/**
 * Diagonal-hatch sprite generator for the driver fills. MapLibre has no CSS-style
 * hatch, so we draw a small tileable diagonal-stripe image on a canvas and register
 * it with map.addImage(), then reference it from a layer as `fill-pattern`.
 *
 * In the colour system, a HATCHED fill = auto / unverified confidence (translucent,
 * provisional); a SOLID fill = verified. See mapTokens (DriverConfidence) and
 * layers.driverFill.
 */
export interface HatchOptions {
  /** Stripe colour (a MAP_TOKENS driver colour). */
  color: string
  /** Tile size in px (default 8). */
  size?: number
  /** Stripe width in px (default 1.5). */
  lineWidth?: number
}

/** Draw one tileable diagonal-hatch tile to a canvas. Returns null when there is
 *  no DOM (SSR / tests), so callers can no-op safely. */
export function makeHatchCanvas({ color, size = 8, lineWidth = 1.5 }: HatchOptions): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'square'
  // Three 45° strokes so the stripe wraps seamlessly across the tile edges.
  ctx.beginPath()
  ctx.moveTo(-size / 2, size / 2)
  ctx.lineTo(size / 2, -size / 2)
  ctx.moveTo(0, size)
  ctx.lineTo(size, 0)
  ctx.moveTo(size / 2, size * 1.5)
  ctx.lineTo(size * 1.5, size / 2)
  ctx.stroke()
  return canvas
}

/** Register a hatch sprite on the map under `id` (idempotent — skips if present).
 *  Requires a loaded map (call on 'load' / 'styledata'). pixelRatio 2 keeps the
 *  stripes crisp on HiDPI. */
export function ensureHatchImage(map: MaplibreMap, id: string, opts: HatchOptions, pixelRatio = 2): void {
  if (!map || map.hasImage(id)) return
  const canvas = makeHatchCanvas(opts)
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  map.addImage(id, image, { pixelRatio })
}
