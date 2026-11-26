import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { expect, test, vi } from 'vitest'
import { DataTable, type Column, type Filter } from './DataTable'

type Person = {
  id: number
  name: string
  status: string
  town: string | null
  value: number | null
  day: string | null
}

const people: Person[] = [
  { id: 1, name: 'Wen Zhao', status: 'customer', town: 'Upland', value: 900, day: '2026-11-24' },
  { id: 2, name: 'adam Kowalski', status: 'lead', town: null, value: 10_000, day: null },
  { id: 3, name: 'Priya Nair', status: 'qualified', town: 'Cedar', value: null, day: '2025-12-31' },
  { id: 4, name: 'Priya Boyd', status: 'lead', town: 'upland north', value: 80, day: '2027-01-02' },
]

const columns: Column<Person>[] = [
  { id: 'name', heading: 'Name', value: (row) => row.name },
  { id: 'status', heading: 'Status', value: (row) => row.status, order: ['lead', 'qualified', 'customer'] },
  { id: 'town', heading: 'Town', value: (row) => row.town },
  { id: 'value', heading: 'Value', value: (row) => row.value, look: 'number' },
  { id: 'day', heading: 'Day', value: (row) => row.day, look: 'date' },
]

const filter: Filter = {
  label: 'Status',
  column: 'status',
  options: [
    { value: 'lead', label: 'Lead' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'customer', label: 'Customer' },
  ],
}
const searched = (row: Person) => [row.name, row.town]
const onEdit = vi.fn()
const onDelete = vi.fn()

function show(rows = people, address = '/people') {
  const router = createMemoryRouter(
    [
      {
        path: '/people',
        element: (
          <DataTable
            what="contact"
            rows={rows}
            columns={columns}
            sort="name"
            searched={searched}
            filter={filter}
            path={(row) => `/people/${row.id}`}
            empty="The people you deal with go here."
            addButton={<button>Add contact</button>}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
      },
      { path: '/people/:id', element: <p>The record</p> },
    ],
    { initialEntries: [address] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const shownIds = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => people.find(({ name }) => within(row).queryByText(name))!.id)

const heading = (name: string) => screen.getByRole('button', { name })
const search = () => screen.getByRole('searchbox', { name: 'Search contacts' })

test.each([
  ['Name', [2, 4, 3, 1], [1, 3, 4, 2]],
  ['Status', [2, 4, 3, 1], [1, 3, 2, 4]],
  ['Town', [3, 1, 4, 2], [4, 1, 3, 2]],
  ['Value', [4, 1, 2, 3], [2, 1, 4, 3]],
  ['Day', [3, 1, 4, 2], [4, 1, 3, 2]],
])('sorts by %s both ways, with blanks last', async (name, ascending, descending) => {
  const user = userEvent.setup()
  show(people, '/people?sort=town')
  if (name === 'Town') await user.click(heading('Name'))
  await user.click(heading(name))
  expect(shownIds()).toEqual(ascending)
  expect(screen.getByRole('columnheader', { name })).toHaveAttribute('aria-sort', 'ascending')
  await user.click(heading(name))
  expect(shownIds()).toEqual(descending)
  expect(screen.getByRole('columnheader', { name })).toHaveAttribute('aria-sort', 'descending')
  await user.click(heading(name))
  expect(shownIds()).toEqual(ascending)
})

test('starts with its usual sort', () => {
  show()
  expect(shownIds()).toEqual([2, 4, 3, 1])
})

test('searches anywhere in the listed fields, ignoring case', async () => {
  const user = userEvent.setup()
  show()
  await user.type(search(), 'UPLAND')
  expect(shownIds()).toEqual([4, 1])
  await user.clear(search())
  await user.type(search(), ' iya ')
  expect(shownIds()).toEqual([4, 3])
  // A field that isn't listed.
  await user.clear(search())
  await user.type(search(), 'customer')
  expect(screen.getByText('No contacts match.')).toBeVisible()
})

test('always says how many rows show', async () => {
  const user = userEvent.setup()
  show()
  expect(screen.getByRole('status')).toHaveTextContent('4 contacts')
  await user.type(search(), 'priya')
  expect(screen.getByRole('status')).toHaveTextContent('2 of 4 contacts')
  await user.type(search(), ' nair')
  expect(screen.getByRole('status')).toHaveTextContent('1 of 4 contacts')
})

test('filters by status, with counts that follow the search', async () => {
  const user = userEvent.setup()
  show()
  const labels = () =>
    within(screen.getByRole('group', { name: 'Status' }))
      .getAllByRole('button')
      .map(({ textContent }) => textContent)
  expect(labels()).toEqual(['All 4', 'Lead 2', 'Qualified 1', 'Customer 1'])

  await user.click(screen.getByRole('button', { name: /^Lead/ }))
  expect(shownIds()).toEqual([2, 4])
  // The other counts still say what choosing them would show.
  expect(labels()).toEqual(['All 4', 'Lead 2', 'Qualified 1', 'Customer 1'])

  await user.type(search(), 'priya')
  expect(shownIds()).toEqual([4])
  expect(labels()).toEqual(['All 2', 'Lead 1', 'Qualified 1', 'Customer 0'])
  expect(screen.getByRole('status')).toHaveTextContent('1 of 4 contacts')

  await user.click(screen.getByRole('button', { name: /^Customer/ }))
  await user.click(screen.getByRole('button', { name: 'Show all contacts' }))
  expect(shownIds()).toHaveLength(4)
})

test('keeps search, sort and filter in the address', async () => {
  const user = userEvent.setup()
  const router = show()
  await user.type(search(), 'priya')
  await user.click(screen.getByRole('button', { name: /^Lead/ }))
  await user.click(heading('Value'))
  expect(router.state.location.search).toBe('?search=priya&filter=lead&sort=value')
})

test('starts with what is in the address', () => {
  show(people, '/people?search=priya&sort=-value')
  expect(search()).toHaveValue('priya')
  expect(shownIds()).toEqual([4, 3])
})

test('typing fast loses nothing', async () => {
  const user = userEvent.setup({ delay: null })
  const router = show()
  await user.type(search(), 'upland north')
  expect(search()).toHaveValue('upland north')
  expect(shownIds()).toEqual([4])
  expect(router.state.location.search).toBe('?search=upland+north')
})

test('follows the address when it changes by itself', async () => {
  const user = userEvent.setup()
  const router = show()
  await user.type(search(), 'priya')
  await router.navigate('/people')
  await vi.waitFor(() => expect(search()).toHaveValue(''))
  expect(shownIds()).toHaveLength(4)
})

test('clicking a row opens the record, and its buttons do not', async () => {
  const user = userEvent.setup()
  const router = show()
  await user.click(screen.getByRole('button', { name: 'Edit Wen Zhao' }))
  expect(onEdit).toHaveBeenCalledWith(people[0])
  await user.click(screen.getByRole('button', { name: 'Delete Wen Zhao' }))
  expect(onDelete).toHaveBeenCalledWith(people[0])
  expect(router.state.location.pathname).toBe('/people')
  await user.click(screen.getByText('Wen Zhao'))
  expect(router.state.location.pathname).toBe('/people/1')
})

test('with no records, says what goes here and offers to add one', () => {
  show([])
  expect(screen.getByText('The people you deal with go here.')).toBeVisible()
  expect(screen.getAllByRole('button', { name: 'Add contact' })).not.toHaveLength(0)
  expect(screen.queryByRole('table')).toBeNull()
})
