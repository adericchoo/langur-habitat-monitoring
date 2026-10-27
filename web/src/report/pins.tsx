import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** A pinned figure/intervention, captured at pin time with enough display data
 *  for the Report step (H2) to render it without reaching back into the source. */
export interface PinnedItem {
  /** Globally unique, e.g. "habitat-loss:kim-bang:remaining" or "policy:pfes". */
  id: string
  /** Step slug the item came from — H2 groups by this. */
  step: string
  label: string
  /** Metrics carry a value; policy interventions don't. */
  value?: string
  unit?: string
  /** Small secondary line: site name, risk level, country. */
  detail?: string
}

interface PinStore {
  items: PinnedItem[]
  isPinned: (id: string) => boolean
  /** Add the item if absent, remove it if already pinned (keyed by id). */
  toggle: (item: PinnedItem) => void
  count: number
}

const PinContext = createContext<PinStore | null>(null)

/** Holds the pinned items for the whole app. Mounted inside App (the layout
 *  route), which stays mounted across step navigation, so pins persist. */
export function PinProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PinnedItem[]>([])

  const toggle = useCallback((item: PinnedItem) => {
    setItems((prev) =>
      prev.some((p) => p.id === item.id)
        ? prev.filter((p) => p.id !== item.id)
        : [...prev, item],
    )
  }, [])

  const value = useMemo<PinStore>(
    () => ({
      items,
      isPinned: (id) => items.some((p) => p.id === id),
      toggle,
      count: items.length,
    }),
    [items, toggle],
  )

  return <PinContext.Provider value={value}>{children}</PinContext.Provider>
}

/** Access the shared pin store. Throws if used outside a PinProvider. */
export function usePins(): PinStore {
  const ctx = useContext(PinContext)
  if (!ctx) throw new Error('usePins must be used within a PinProvider')
  return ctx
}
