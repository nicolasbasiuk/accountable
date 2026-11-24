import { expect, test } from 'vitest'
import { scale } from './scale'

test('the steps are round, with room above, as in mockup D', () => {
  expect(scale(203_500)).toEqual({ top: 250_000, ticks: [0, 100_000, 200_000] })
  expect(scale(210_000)).toEqual({ top: 250_000, ticks: [0, 100_000, 200_000] })
  expect(scale(187_000)).toEqual({ top: 225_000, ticks: [0, 50_000, 100_000, 150_000, 200_000] })
  expect(scale(100_000)).toEqual({ top: 125_000, ticks: [0, 50_000, 100_000] })
})

test.each([1, 2, 3, 9, 10, 499, 500, 9_000, 99_999, 100_000, 249_999, 250_000, 999_999, 1_000_000, 999_999_999, 999_999_999_999])(
  'for %i it has few steps in whole dollars, and room for the label',
  (highest) => {
    const { top, ticks } = scale(highest)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
    expect(ticks.length).toBeLessThanOrEqual(6)
    expect(ticks.every(Number.isInteger)).toBe(true)
    expect(ticks.at(-1)).toBeLessThanOrEqual(top)
    expect(top).toBeGreaterThanOrEqual(highest * 1.1)
  },
)
