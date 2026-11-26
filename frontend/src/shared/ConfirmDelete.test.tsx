import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ConfirmDelete, consequences } from './ConfirmDelete'
import { createQueryClient } from './queryClient'

test.each([
  ['organization', { contacts: 4, deals: 3 }, '4 contacts and 3 deals are kept, with no organization.'],
  ['organization', { contacts: 1, deals: 1 }, '1 contact and 1 deal are kept, with no organization.'],
  ['organization', { contacts: 1, deals: 0 }, '1 contact is kept, with no organization.'],
  ['organization', { contacts: 0, deals: 2 }, '2 deals are kept, with no organization.'],
  ['organization', { contacts: 0, deals: 0 }, ''],
  [
    'contact',
    { deals: 2, activities: 5, follow_ups: 1 },
    '2 deals are kept, with no main contact. 5 activities are deleted, 1 with a follow-up still to do.',
  ],
  ['contact', { deals: 1, activities: 0, follow_ups: 0 }, '1 deal is kept, with no main contact.'],
  ['contact', { deals: 0, activities: 1, follow_ups: 0 }, '1 activity is deleted.'],
  ['contact', { deals: 0, activities: 0, follow_ups: 0 }, ''],
  ['deal', { activities: 6, follow_ups: 2 }, '6 activities are deleted, 2 with a follow-up still to do.'],
  ['deal', { activities: 1, follow_ups: 1 }, '1 activity is deleted, with a follow-up still to do.'],
  ['deal', { activities: 3, follow_ups: 0 }, '3 activities are deleted.'],
  ['deal', { activities: 0, follow_ups: 0 }, ''],
  ['activity', { follow_ups: 1 }, 'Its follow-up is deleted too.'],
  ['activity', { follow_ups: 0 }, ''],
] as const)('%s with %o', (what, numbers, text) => {
  expect(consequences(what, numbers).join(' ')).toBe(text)
})

function show(answers: (method: string, path: string) => Response) {
  const asked: string[] = []
  vi.stubGlobal('fetch', async (path: string, { method }: { method: string }) => {
    asked.push(`${method} ${path}`)
    return answers(method, path)
  })
  const onClosed = vi.fn()
  const onDeleted = vi.fn()
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ConfirmDelete what="contact" name="Priya Nair" path="/contacts/7" onDeleted={onDeleted} onClosed={onClosed} />
    </QueryClientProvider>,
  )
  return { asked, onClosed, onDeleted, user: userEvent.setup() }
}

const numbers = () => Response.json({ deals: 2, activities: 5, follow_ups: 1 })

test('names the record and says what happens, then deletes', async () => {
  const { user, asked, onClosed, onDeleted } = show((method) =>
    method === 'GET' ? numbers() : Response.json({ id: 7 }),
  )
  expect(await screen.findByText(/2 deals are kept, with no main contact/)).toBeVisible()
  expect(screen.getByRole('alertdialog', { name: 'Delete Priya Nair?' })).toBeVisible()
  expect(asked).toEqual(['GET /api/contacts/7/deletion'])

  await user.click(screen.getByRole('button', { name: 'Delete contact' }))
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
  expect(onDeleted).toHaveBeenCalledOnce()
  // It doesn't ask about the record that has gone.
  expect(asked).toEqual(['GET /api/contacts/7/deletion', 'DELETE /api/contacts/7'])
})

test('cancelling deletes nothing', async () => {
  const { user, asked, onClosed } = show(numbers)
  await screen.findByText(/2 deals are kept/)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
  expect(asked).toEqual(['GET /api/contacts/7/deletion'])
})

test('says why it could not be deleted', async () => {
  const { user, onDeleted, onClosed } = show((method) =>
    method === 'GET' ? numbers() : new Response('Not JSON', { status: 500 }),
  )
  await user.click(await screen.findByRole('button', { name: 'Delete contact' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Not deleted. The server can't be reached.")
  expect(onDeleted).not.toHaveBeenCalled()
  expect(onClosed).not.toHaveBeenCalled()
})
