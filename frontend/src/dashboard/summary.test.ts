import { expect, test } from 'vitest'
import { summary } from './summary'

test.each([
  [6, 4, '6 follow-ups are overdue and 4 deals are late.'],
  [1, 1, '1 follow-up is overdue and 1 deal is late.'],
  [2, 1, '2 follow-ups are overdue and 1 deal is late.'],
  [6, 0, '6 follow-ups are overdue.'],
  [1, 0, '1 follow-up is overdue.'],
  [0, 4, '4 deals are late.'],
  [0, 1, '1 deal is late.'],
  [0, 0, 'Nothing is overdue or late.'],
])('%i overdue and %i late', (overdue, late, text) => {
  expect(summary(overdue, late)).toBe(text)
})
