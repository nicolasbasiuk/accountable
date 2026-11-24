import { plural } from '../shared/format'

/** Marks an open deal past its close date (D5). Nothing if it isn't. */
export function LateTag({ days }: { days: number }) {
  return days > 0 && <span className="tag">Late {plural(days, 'day')}</span>
}
