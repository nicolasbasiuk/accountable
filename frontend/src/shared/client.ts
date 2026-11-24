// Requests to the server, and what can go wrong with one.

export type Fields = Record<string, string>

type Kind = 'unreachable' | 'notFound' | 'conflict' | 'invalid' | 'failed'

export class ApiError extends Error {
  readonly kind: Kind
  readonly fields: Fields

  constructor(kind: Kind, message: string, fields: Fields = {}) {
    super(message)
    this.kind = kind
    this.fields = fields
  }
}

const KINDS: Record<number, Kind> = { 404: 'notFound', 409: 'conflict', 422: 'invalid' }

async function request<T>(method: string, path: string, body?: object): Promise<T> {
  let status: number
  let answer: unknown
  try {
    const response = await fetch(`/api${path}`, {
      method,
      ...(body && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
    })
    status = response.status
    // With the server down, Vite answers in plain text, so not being JSON means the same.
    answer = await response.json()
  } catch {
    throw new ApiError('unreachable', "The server can't be reached.")
  }
  if (status < 400) return answer as T
  const { message, fields } = answer as { message?: string; fields?: Fields }
  throw new ApiError(KINDS[status] ?? 'failed', message ?? 'Something went wrong on the server.', fields)
}

export const get = <T>(path: string) => request<T>('GET', path)
export const post = <T = { id: number }>(path: string, body: object) => request<T>('POST', path, body)
export const patch = (path: string, body: object) => request<{ id: number }>('PATCH', path, body)
export const remove = (path: string) => request<{ id: number }>('DELETE', path)

/** What to tell the person when something couldn't be done. */
export function explain(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong.'
}

export const isNotFound = (error: unknown) => error instanceof ApiError && error.kind === 'notFound'
export const isConflict = (error: unknown) => error instanceof ApiError && error.kind === 'conflict'
