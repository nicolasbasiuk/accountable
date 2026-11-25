// Checks and small helpers that the forms share. The server checks everything again.

/** A rule for a field that can't be left blank. */
export const required = (message: string) => ({ validate: (value: string) => value.trim() !== '' || message })

/** True, or what to say about a date, or a date and time. Chrome makes 0026 of a year typed as 26. */
export const checkYear = (day: string): true | string => day === '' || day >= '1000' || 'Enter the year with four digits, such as 2026.'

/** The fields that were changed, because an edit sends nothing else. */
export function changed<V extends object>(before: V, after: V): Partial<V> {
  return Object.fromEntries(Object.entries(after).filter(([field, value]) => value !== before[field as keyof V])) as Partial<V>
}

/** The id in a record's address, or undefined if it can't be one. */
export function recordId(text: string | undefined): number | undefined {
  return text && /^[1-9]\d{0,14}$/.test(text) ? Number(text) : undefined
}
