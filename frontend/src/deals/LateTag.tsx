import { Count } from '../shared/Count'

/** Marks an open deal past its close date (D5). Nothing if it isn't. */
export function LateTag({ days }: { days: number }) {
  return days > 0 && <span className="tag">Late <Count amount={days} word="day" /></span>
}
