import type { Status } from './queries'

export const STATUSES: Status[] = ['lead', 'qualified', 'customer']

export const STATUS_NAMES: Record<Status, string> = { lead: 'Lead', qualified: 'Qualified', customer: 'Customer' }

const DOTS: Record<Status, string> = { lead: 'bg-coral', qualified: 'bg-marigold', customer: 'bg-sea-green' }

/** A colored dot with its name, because color is never the only sign. */
export function StatusName({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <i aria-hidden className={`size-2.5 flex-none rounded-full ${DOTS[status]}`} />
      {STATUS_NAMES[status]}
    </span>
  )
}
