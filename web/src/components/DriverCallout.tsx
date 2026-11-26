import type { DriverBlobProps } from '../types/drivers'

const DRIVER_NAME: Record<DriverBlobProps['driver'], string> = {
  quarry: 'Quarry',
  agriculture: 'Agriculture',
}

const fmt = (n: number) => n.toLocaleString('en-US')
const signed = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`

/**
 * Driver-blob callout (shown in the map Popup). AIFG chrome tokens. Screening
 * language only — never "confirmed" / "detected".
 */
export default function DriverCallout({ blob }: { blob: DriverBlobProps }) {
  const { driver, areaHa, regionAreaHa, deltaHa, window, confidence } = blob
  return (
    <div className="min-w-[210px] font-sans text-ink">
      <p className="text-sm font-bold text-navy">{DRIVER_NAME[driver]}</p>
      <dl className="mt-1.5 space-y-1 text-xs">
        <Row label="Whole footprint" value={`${fmt(areaHa)} ha`} />
        <Row label="In this region (habitat loss)" value={`${fmt(regionAreaHa)} ha`} emphasise />
        <Row label={`Growth ${window[0]}–${window[1]}`} value={`${signed(deltaHa)} ha`} />
        <Row label="Confidence" value={`${confidence.label} (${confidence.score.toFixed(2)})`} />
      </dl>
      <p className="mt-2 border-t border-brd pt-1.5 text-[11px] leading-snug text-secondary">
        Auto-flagged footprint · screening, not field-verified. The whole object may sit
        mostly outside the habitat; only the in-region part is counted as habitat loss.
      </p>
    </div>
  )
}

function Row({ label, value, emphasise }: { label: string; value: string; emphasise?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className={emphasise ? 'font-bold text-magenta' : 'font-semibold text-navy'}>{value}</dd>
    </div>
  )
}
