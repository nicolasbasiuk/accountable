// Checks and small helpers that the forms share. The server checks everything again.

/** A rule for a field that can't be left blank. */
export const required = (message: string) => ({ validate: (value: string) => value.trim() !== '' || message })

/** The fields that were changed, because an edit sends nothing else. */
export function changed<V extends object>(before: V, after: V): Partial<V> {
  return Object.fromEntries(Object.entries(after).filter(([field, value]) => value !== before[field as keyof V])) as Partial<V>
}

/** The id in a record's address, or undefined if it can't be one. */
export function recordId(text: string | undefined): number | undefined {
  return text && /^[1-9]\d{0,14}$/.test(text) ? Number(text) : undefined
}
