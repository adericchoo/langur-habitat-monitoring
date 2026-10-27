export interface LayerToggle {
  id: string
  label: string
  enabled: boolean
}

export interface LayerControlProps {
  layers: LayerToggle[]
  onToggle: (id: string) => void
}

/** Small overlay panel to toggle map layers on/off. */
export default function LayerControl({ layers, onToggle }: LayerControlProps) {
  return (
    <div className="absolute left-3 top-3 z-10 rounded-card border border-brd bg-card p-3 font-sans shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Layers</p>
      <ul className="space-y-1.5">
        {layers.map((layer) => (
          <li key={layer.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={layer.enabled}
                onChange={() => onToggle(layer.id)}
                className="h-4 w-4 accent-teal"
              />
              {layer.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
