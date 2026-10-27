import type { ReactNode } from 'react'

export interface SidebarProps {
  eyebrow?: string
  title: string
  subtitle?: string
  /** Optional element pinned top-right of the header (e.g. a "Report · N pinned" chip). */
  headerAction?: ReactNode
  children: ReactNode
}

/** Off-white sidebar surface: fixed header block + scrollable body. */
export default function Sidebar({
  eyebrow,
  title,
  subtitle,
  headerAction,
  children,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col bg-offwhite font-sans text-ink">
      <header className="flex items-start justify-between gap-3 border-b border-brd px-5 py-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-xl font-bold text-navy">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-secondary">{subtitle}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  )
}
