import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Region } from './registry'

/**
 * Shared active-region state (Step Zero · Set region). Lifted to the router root
 * so Step Zero, the persistent top-bar chip, and every gated step read the SAME
 * one region at a time — switching replaces context, never combines. Mirrors the
 * CompareContext pattern.
 *
 * Persisted to sessionStorage (guarded) so a refresh mid-flow keeps the chosen
 * region instead of bouncing back to Step Zero. Storage is a per-tab convenience
 * only — the source of truth is this in-memory state.
 */
interface RegionStore {
  /** The chosen region, or null until one is set (the Step Zero "empty" state). */
  activeRegion: Region | null
  /** Replace the active region (or clear with null). One at a time. */
  setActiveRegion: (region: Region | null) => void
}

const STORAGE_KEY = 'langur.activeRegion'

function readStored(): Region | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Region) : null
  } catch {
    return null
  }
}

function writeStored(region: Region | null) {
  try {
    if (region) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(region))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode, blocked) — in-memory state still works */
  }
}

const RegionContext = createContext<RegionStore | null>(null)

export function RegionProvider({ children }: { children: ReactNode }) {
  const [activeRegion, setActiveRegionState] = useState<Region | null>(readStored)

  const setActiveRegion = useCallback((region: Region | null) => {
    setActiveRegionState(region)
    writeStored(region)
  }, [])

  const value = useMemo<RegionStore>(
    () => ({ activeRegion, setActiveRegion }),
    [activeRegion, setActiveRegion],
  )

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
}

/** Access the shared region store. Throws outside a RegionProvider. */
export function useRegion(): RegionStore {
  const ctx = useContext(RegionContext)
  if (!ctx) throw new Error('useRegion must be used within a RegionProvider')
  return ctx
}

/** Like useRegion but returns null outside a provider (for components also used
 *  by /gallery, which lives outside the app shell). */
export function useRegionOptional(): RegionStore | null {
  return useContext(RegionContext)
}
