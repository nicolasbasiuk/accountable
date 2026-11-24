import { plural } from '../shared/format'

/** The one line under the heading. */
export function summary(overdue: number, late: number): string {
  const followUps = `${plural(overdue, 'follow-up')} ${overdue === 1 ? 'is' : 'are'} overdue`
  const deals = `${plural(late, 'deal')} ${late === 1 ? 'is' : 'are'} late`
  if (overdue && late) return `${followUps} and ${deals}.`
  if (overdue) return `${followUps}.`
  if (late) return `${deals}.`
  return 'Nothing is overdue or late.'
}
