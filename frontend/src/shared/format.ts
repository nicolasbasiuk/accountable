// How money, dates and times are shown (G7, G8).
// A date such as 2026-11-24 is split into its parts. It never goes through new Date('2026-11-24'),
// which is midnight in UTC, and so the day before in the Americas.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 24 * 60 * 60 * 1000

const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const money = (amount: number) => wholeDollars.format(amount)

/** For the axis of a chart: $0, $500, $50K, $1.5M. */
export function shortMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${amount / 1_000_000}M`
  if (amount >= 1_000) return `$${amount / 1_000}K`
  return `$${amount}`
}

export const percent = (amount: number) => `${amount}%`
export const share = (fraction: number) => `${Math.round(fraction * 100)}%`

function parts(day: string): [number, number, number] {
  const [year, month, dayOfMonth] = day.split('-').map(Number)
  return [year!, month!, dayOfMonth!]
}

/** 2026-11-24 as Nov 24, 2026 */
export function date(day: string): string {
  const [year, month, dayOfMonth] = parts(day)
  return `${MONTHS[month - 1]} ${dayOfMonth}, ${year}`
}

export const monthName = (day: string) => MONTHS[parts(day)[1] - 1]!
export const monthAndYear = (day: string) => `${monthName(day)} ${parts(day)[0]}`

const utc = (day: string) => {
  const [year, month, dayOfMonth] = parts(day)
  return Date.UTC(year, month - 1, dayOfMonth)
}

export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY_MS)

/** When something is due: Today, Tomorrow or its date. */
export function due(day: string, today: string): string {
  const days = daysBetween(today, day)
  if (days === 0) return 'Today'
  return days === 1 ? 'Tomorrow' : date(day)
}

/** The first line of a text, shortened, for where there's little room. */
export function shorten(text: string, length = 60): string {
  const line = text.split('\n')[0]!
  return line.length > length ? `${line.slice(0, length).trimEnd()}...` : line
}

export const plural = (amount: number, word: string) => `${amount} ${word}${amount === 1 ? '' : 's'}`

// Moments, such as 2026-11-24T15:20:00Z, are shown in local time.

const two = (amount: number) => String(amount).padStart(2, '0')

/** The local day of a moment. */
export function dayOf(moment: string): string {
  const at = new Date(moment)
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
}

/** 3:20 PM */
export function time(moment: string): string {
  const at = new Date(moment)
  const hour = at.getHours()
  return `${hour % 12 || 12}:${two(at.getMinutes())} ${hour < 12 ? 'AM' : 'PM'}`
}

export const dateTime = (moment: string) => `${date(dayOf(moment))}, ${time(moment)}`

/** A moment as a date and time field wants it, in local time. */
export function toField(moment: string): string {
  const at = new Date(moment)
  return `${dayOf(moment)}T${two(at.getHours())}:${two(at.getMinutes())}`
}

/** What was chosen in a date and time field, as a moment. */
export const fromField = (text: string) => new Date(text).toISOString().replace('.000Z', 'Z')
