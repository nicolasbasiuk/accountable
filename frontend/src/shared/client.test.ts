import { expect, test, vi } from 'vitest'
import { explain, get, isConflict, isNotFound, patch, post, remove, type ApiError } from './client'

const answer = (response: () => Response | Promise<Response>) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response()),
  )
const problem = async (work: Promise<unknown>) =>
  (await work.then(
    () => undefined,
    (error) => error,
  )) as ApiError

test('sends and reads JSON', async () => {
  answer(() => Response.json({ id: 7 }))
  expect(await post('/deals', { name: 'A' })).toEqual({ id: 7 })
  expect(fetch).toHaveBeenCalledWith('/api/deals', {
    method: 'POST',
    body: '{"name":"A"}',
    headers: { 'Content-Type': 'application/json' },
  })
})

test('each kind of request', async () => {
  answer(() => Response.json([]))
  await get('/deals')
  await patch('/deals/1', {})
  await remove('/deals/1')
  expect(vi.mocked(fetch).mock.calls.map(([path, options]) => `${options!.method} ${path as string}`)).toEqual([
    'GET /api/deals',
    'PATCH /api/deals/1',
    'DELETE /api/deals/1',
  ])
})

test('field problems', async () => {
  answer(() => Response.json({ message: 'Not valid.', fields: { name: 'Enter a name.' } }, { status: 422 }))
  const error = await problem(post('/deals', {}))
  expect(error).toMatchObject({ kind: 'invalid', message: 'Not valid.', fields: { name: 'Enter a name.' } })
})

test('not found, and a conflict', async () => {
  answer(() => Response.json({ message: 'Gone.', fields: {} }, { status: 404 }))
  expect(isNotFound(await problem(get('/deals/9')))).toBe(true)
  answer(() => Response.json({ message: 'Moved.', fields: {} }, { status: 409 }))
  const error = await problem(post('/deals/9/move', {}))
  expect([isConflict(error), isNotFound(error), explain(error)]).toEqual([true, false, 'Moved.'])
})

test('a failure on the server', async () => {
  answer(() => Response.json({ message: 'Something went wrong on the server.', fields: {} }, { status: 500 }))
  expect(await problem(get('/deals'))).toMatchObject({ kind: 'failed' })
})

test.each([
  ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
  ['an answer that is not JSON', () => new Response('Error: connect ECONNREFUSED', { status: 500 })],
  ['a page instead of JSON', () => new Response('<!doctype html>', { status: 200 })],
])("%s means the server can't be reached", async (_what, response) => {
  answer(response)
  const error = await problem(get('/deals'))
  expect(error.kind).toBe('unreachable')
  expect(explain(error)).toBe("The server can't be reached.")
})

test('anything else', () => {
  expect(explain(new Error('Internal detail'))).toBe('Something went wrong.')
})
