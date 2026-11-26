import { MAP_TOKENS } from '../map/mapTokens'

/** Display status for the driver-site control line (the five states). */
export type DriverDisplayStatus = 'loading' | 'empty' | 'stale' | 'error' | 'ready'

export interface DriverControlsProps {
  minHa: number
  onMinHa: (value: number) => void
  maxHa?: number
  status: DriverDisplayStatus
  /** Count of blobs in the active region (ready state), for the status line. */
  count: number
}

const MESSAGE: Record<Exclude<DriverDisplayStatus, 'ready'>, string> = {
  loading: 'Loading driver sites…',
  empty: 'No driver sites flagged in this region · screening',
  stale: 'Showing sample driver sites · screening',
  error: 'Driver sites unavailable',
}

/**
 * Min-area highlight filter + driver status, shown in the LAYERS panel footer on
 * Step 01. The slider is a DISPLAY declutter only — blobs below it are hidden from
 * the map; the sidebar "loss by driver" % is unaffected (it reads the metrics, not
 * these blobs). Dark chrome via MAP_TOKENS to match the panel.
 */
export default function DriverControls({ minHa, onMinHa, maxHa = 500, status, count }: DriverControlsProps) {
  const message = status === 'ready' ? `${count} driver site${count === 1 ? '' : 's'} · screening` : MESSAGE[status]
  return (
    <div className="mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(248,250,252,0.15)' }}>
      <label className="block">
        <span
          className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide"
          style={{ color: MAP_TOKENS.region }}
        >
          <span>Highlight ≥ area</span>
          <span style={{ color: MAP_TOKENS.label }}>{minHa.toLocaleString('en-US')} ha</span>
        </span>
        <input
          type="range"
          min={0}
          max={maxHa}
          step={10}
          value={minHa}
          onChange={(e) => onMinHa(Number(e.target.value))}
          aria-label="Minimum driver footprint area to highlight (hectares)"
          aria-valuetext={`${minHa} hectares`}
          className="w-full accent-teal"
        />
      </label>
      <p className="mt-1 text-[10px] leading-tight" style={{ color: MAP_TOKENS.region }}>
        {message}
      </p>
    </div>
  )
}
