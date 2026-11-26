import { useEffect, useRef } from 'react'
import { MAP_TOKENS } from '../map/mapTokens'

/**
 * Step Zero timelapse scrubber (bottom): drags/plays a year across the basemap
 * range and swaps the basemap SOURCE by year — BASEMAP ONLY, no recomputation or
 * analysis layers. Imagery snaps to the nearest year we actually have tiles for
 * (resolveBasemapYear, in the parent); the readout shows the scrubbed year even
 * when the imagery snaps. Controlled: the year lives in the parent (it drives the
 * map source); this owns the play/drag UX and ticks.
 */
export interface BasemapTimelapseProps {
  year: number
  onYear: (year: number) => void
  minYear: number
  maxYear: number
  playing: boolean
  onPlayToggle: () => void
  /** Evenly-spaced tick labels under the track. */
  ticks: number[]
}

const STEP_MS = 450

export default function BasemapTimelapse({
  year,
  onYear,
  minYear,
  maxYear,
  playing,
  onPlayToggle,
  ticks,
}: BasemapTimelapseProps) {
  // Advance the year on an interval while playing; stop at the end. Kept here so
  // the play button owns its own cadence. Reads the latest year via a ref so the
  // effect doesn't restart every tick.
  const yearRef = useRef(year)
  yearRef.current = year
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const next = yearRef.current + 1
      if (next > maxYear) {
        onPlayToggle() // reached the end — pause
      } else {
        onYear(next)
      }
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [playing, maxYear, onYear, onPlayToggle])

  const pct = ((year - minYear) / (maxYear - minYear)) * 100

  return (
    <div
      className="flex items-center gap-4 rounded-card px-4 py-3 font-sans shadow-sm"
      style={{ backgroundColor: 'rgba(11,18,33,0.9)', border: '1px solid rgba(248,250,252,0.15)' }}
    >
      <button
        type="button"
        onClick={onPlayToggle}
        aria-pressed={playing}
        aria-label={playing ? 'Pause timelapse' : 'Play timelapse'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill accent-teal"
        style={{ backgroundColor: MAP_TOKENS.habitatFill, color: MAP_TOKENS.labelHalo }}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="min-w-0 flex-1">
        {/* Filled-track hint behind the native range input. */}
        <div
          className="relative h-1.5 rounded-pill"
          style={{ backgroundColor: 'rgba(248,250,252,0.25)' }}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0 rounded-pill"
            style={{ width: `${pct}%`, backgroundColor: MAP_TOKENS.habitatFill }}
          />
        </div>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          aria-label="Basemap year"
          aria-valuetext={`${year}, basemap only`}
          className="mt-[-9px] w-full accent-teal"
        />
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: MAP_TOKENS.region }}>
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-2xl font-bold leading-none" style={{ color: MAP_TOKENS.label }}>
          {year}
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: MAP_TOKENS.region }}>
          basemap only
        </div>
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11l9-5.5-9-5.5Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />
    </svg>
  )
}
