import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { configQuery, type Config } from '../shared/config'
import { createQueryClient } from '../shared/queryClient'
import type { Area, Entry, EntryRecord } from './queries'
import { Timeline } from './Timeline'

const config: Config = {
  today: '2026-11-24',
  now: '2026-11-24T12:00:00Z',
  stages: [
    { key: 'proposal', name: 'Proposal', probability: 50, open: true },
    { key: 'negotiation', name: 'Negotiation', probability: 75, open: true },
  ],
}
const deal: EntryRecord = { kind: 'deal', id: 7, name: 'Cloud migration', organization: { id: 1, name: 'Upland Water' } }
const contact: EntryRecord = { kind: 'contact', id: 3, name: 'Priya Nair', organization: null }

const activity = (id: number, more: object): Entry => ({
  kind: 'activity', id, at: '2026-11-20T12:00:00Z', type: 'call', description: `Call ${id}`, follow_up_on: null, done: false, record: deal, ...more,
})

const entries: Entry[] = [
  activity(1, { follow_up_on: '2026-11-21' }),
  activity(2, { follow_up_on: '2026-11-24', type: 'email', record: contact }),
  activity(3, { follow_up_on: '2026-11-01', done: true, type: 'note' }),
  activity(4, {}),
  { kind: 'stage_change', id: 1, at: '2026-11-19T12:00:00Z', from_stage: 'proposal', to_stage: 'negotiation', record: deal },
]

let changes: { method: string; path: string; body: unknown }[]
let answer: () => Response

beforeEach(() => {
  changes = []
  answer = () => Response.json({ id: 1 })
})

async function show(area: Area, id: number, list = entries) {
  vi.stubGlobal('fetch', async (path: string, options: RequestInit) => {
    if (path === '/api/config') return Response.json(config)
    if (options.method === 'GET') return Response.json(list)
    changes.push({ method: options.method!, path, body: options.body && JSON.parse(options.body as string) })
    return answer()
  })
  const client = createQueryClient()
  client.setQueryData(configQuery.queryKey, config)
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Timeline area={area} id={id} on={area === 'deals' ? { deal_id: id } : area === 'contacts' ? { contact_id: id } : undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  if (list.length) await screen.findAllByRole('listitem')
  return userEvent.setup()
}

const item = (text: string) => screen.getByText(text).closest('li')!

test('an activity can be edited and deleted, and a change of stage cannot', async () => {
  await show('deals', 7)
  expect(within(item('Call 1')).getByRole('button', { name: 'Edit "Call 1"' })).toBeVisible()
  expect(within(item('Call 1')).getByRole('button', { name: 'Delete "Call 1"' })).toBeVisible()
  const change = item('Moved from Proposal to Negotiation')
  expect(within(change).queryByRole('button')).toBeNull()
  expect(within(change).queryByRole('checkbox')).toBeNull()
})

test("an entry of another record names it and links to it", async () => {
  await show('deals', 7)
  expect(within(item('Call 2')).getByRole('link', { name: 'Priya Nair' })).toHaveAttribute('href', '/contacts/3')
  // Its own page doesn't name itself.
  expect(within(item('Call 1')).queryByRole('link')).toBeNull()
})

test('an organization names the record of every entry', async () => {
  await show('organizations', 1)
  expect(screen.getAllByRole('link')).toHaveLength(entries.length)
  expect(within(item('Call 1')).getByRole('link', { name: 'Cloud migration' })).toHaveAttribute('href', '/deals/7')
  expect(item('Call 1')).toHaveTextContent('Cloud migration, Upland Water')
  expect(screen.queryByRole('button', { name: 'Log activity' })).toBeNull()
})

test("a deal and a contact with the same number aren't mixed up", async () => {
  await show('contacts', 7)
  expect(within(item('Call 1')).getByRole('link', { name: 'Cloud migration' })).toBeVisible()
})

test('a follow-up says whether it is overdue or done', async () => {
  await show('deals', 7)
  expect(item('Call 1')).toHaveTextContent('Overdue 3 days')
  expect(within(item('Call 1')).getByRole('checkbox', { name: 'Done: Call 1' })).not.toBeChecked()
  // Due today isn't overdue, and neither is one that's done.
  expect(item('Call 2')).not.toHaveTextContent('Overdue')
  expect(item('Call 3')).not.toHaveTextContent('Overdue')
  expect(item('Call 3')).toHaveTextContent('Done')
  expect(within(item('Call 3')).getByRole('checkbox')).toBeChecked()
  expect(within(item('Call 4')).queryByRole('checkbox')).toBeNull()
})

test('marks a follow-up done, and not done again', async () => {
  const user = await show('deals', 7)
  await user.click(screen.getByRole('checkbox', { name: 'Done: Call 1' }))
  await user.click(screen.getByRole('checkbox', { name: 'Done: Call 3' }))
  expect(changes).toEqual([
    { method: 'PATCH', path: '/api/activities/1', body: { done: true } },
    { method: 'PATCH', path: '/api/activities/3', body: { done: false } },
  ])
})

test('goes back when it could not be saved', async () => {
  answer = () => Response.json({ message: 'No.', fields: {} }, { status: 500 })
  const user = await show('deals', 7)
  await user.click(screen.getByRole('checkbox', { name: 'Done: Call 1' }))
  await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: 'Done: Call 1' })).not.toBeChecked())
})

test('logs an activity on the record, leaving "now" to the server', async () => {
  const user = await show('contacts', 3)
  await user.click(screen.getByRole('button', { name: 'Log activity' }))
  await user.click(await screen.findByRole('radio', { name: 'Email' }))
  await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Sent the plan')
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Log activity' }))
  await vi.waitFor(() =>
    expect(changes).toEqual([{ method: 'POST', path: '/api/activities', body: { contact_id: 3, type: 'email', description: 'Sent the plan' } }]),
  )
})

test('an edit sends only what changed', async () => {
  const user = await show('deals', 7)
  await user.click(screen.getByRole('button', { name: 'Edit "Call 1"' }))
  await user.clear(await within(await screen.findByRole('dialog')).findByLabelText(/Follow up on/))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  await vi.waitFor(() => expect(changes).toEqual([{ method: 'PATCH', path: '/api/activities/1', body: { follow_up_on: null } }]))
})

test('a description is required', async () => {
  const user = await show('deals', 7)
  await user.click(screen.getByRole('button', { name: 'Log activity' }))
  await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Log activity' }))
  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveAccessibleDescription('Enter a description.')
  expect(changes).toEqual([])
})

test('with no entries, says what goes here', async () => {
  await show('deals', 7, [])
  expect(await screen.findByText('Notes, calls, emails and changes of stage go here.')).toBeVisible()
})
