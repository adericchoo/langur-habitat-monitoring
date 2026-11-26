export interface LayerToggle {
  id: string
  label: string
  enabled: boolean
}

import { useState, type ReactNode } from 'react'

export interface LayerControlProps {
  layers: LayerToggle[]
  onToggle: (id: string) => void
  /** Optional extra controls rendered under the toggle list (e.g. the driver
   *  min-area slider + status on Step 01). Shows with the expanded panel. */
  footer?: ReactNode
}

/** Small overlay panel to toggle map layers on/off. Collapsed to its label until
 *  hovered, keyboard-focused, or the label is clicked (tap-friendly). */
export default function LayerControl({ layers, onToggle, footer }: LayerControlProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="group absolute left-3 top-3 z-10 rounded-card border border-[#F8FAFC]/15 bg-[#0B1221]/90 px-2 py-1.5 font-sans shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="block cursor-pointer text-[9px] font-semibold uppercase tracking-wide text-[#CBD5E1]"
      >
        Layers
      </button>
      <div className={`group-hover:block group-focus-within:block ${open ? 'block' : 'hidden'}`}>
        <ul className="mt-1 space-y-0.5">
          {layers.map((layer) => (
            <li key={layer.id}>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] leading-tight text-[#F8FAFC]">
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={() => onToggle(layer.id)}
                  className="h-3 w-3 accent-teal"
                />
                {layer.label}
              </label>
            </li>
          ))}
        </ul>
        {footer}
      </div>
    </div>
  )
}
