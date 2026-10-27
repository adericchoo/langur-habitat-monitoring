export interface PolicyBoxProps {
  name: string
  /** Short country label shown as a chip. */
  country: string
  description: string
  source: string
  howItFits: string
  limitations: string
  pinned?: boolean
  onTogglePin?: () => void
}

/** A policy-brief card: name + country chip, description, source + pin, and the
 *  "How it fits" / "Limitations" sections. */
export default function PolicyBox({
  name,
  country,
  description,
  source,
  howItFits,
  limitations,
  pinned = false,
  onTogglePin,
}: PolicyBoxProps) {
  return (
    <div className="rounded-card border border-brd bg-card p-5 font-sans text-ink">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-navy">{name}</h3>
        <span className="shrink-0 rounded-pill bg-teal-tint px-2.5 py-0.5 text-xs font-semibold text-teal">
          {country}
        </span>
      </div>

      <p className="mt-2 text-sm">{description}</p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-brd pt-3">
        <p className="min-w-0 truncate text-xs text-secondary">Source: {source}</p>
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          className={[
            'shrink-0 rounded-pill px-3 py-1 text-xs font-semibold',
            pinned ? 'bg-teal-tint text-teal' : 'border border-brd text-secondary hover:text-navy',
          ].join(' ')}
        >
          {pinned ? 'Pinned' : <><span className="mr-1 text-teal">●</span>Add</>}
        </button>
      </div>

      <PolicySection label="How it fits" body={howItFits} />
      <PolicySection label="Limitations" body={limitations} />
    </div>
  )
}

function PolicySection({ label, body }: { label: string; body: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal">{label}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  )
}
