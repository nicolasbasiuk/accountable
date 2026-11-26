import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusName } from '../contacts/StatusName'
import { configQuery, type Config, type Stage } from '../shared/config'
import { LateTag } from './LateTag'
import { StageName } from './StageName'
import { STAGE_LOOKS } from './stages'

const names: Record<Stage, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

test.each(Object.entries(names))('the stage %s always shows its name', (key, name) => {
  const client = new QueryClient()
  const stages = Object.entries(names).map(([stage, label]) => ({
    key: stage as Stage,
    name: label,
    probability: 0,
    open: true,
  }))
  client.setQueryData<Config>(configQuery.queryKey, { today: '2026-11-24', now: '2026-11-24T12:00:00Z', stages })
  render(
    <QueryClientProvider client={client}>
      <StageName stage={key as Stage} />
    </QueryClientProvider>,
  )
  expect(screen.getByText(name)).toBeVisible()
})

test('every stage has a color of its own', () => {
  expect(new Set(Object.values(STAGE_LOOKS).map(({ color }) => color)).size).toBe(6)
})

test.each([
  ['lead', 'Lead'],
  ['qualified', 'Qualified'],
  ['customer', 'Customer'],
] as const)('the status %s always shows its name', (status, name) => {
  render(<StatusName status={status} />)
  expect(screen.getByText(name)).toBeVisible()
})

test('late says so in words', () => {
  const { rerender, container } = render(<LateTag days={1} />)
  // The number is an element of its own, in the font of numbers.
  expect(container).toHaveTextContent(/^Late 1 day$/)
  expect(container.firstElementChild).toBeVisible()
  expect(screen.getByText('1')).toHaveClass('num')
  rerender(<LateTag days={11} />)
  expect(container).toHaveTextContent(/^Late 11 days$/)
  rerender(<LateTag days={0} />)
  expect(container).toBeEmptyDOMElement()
})
