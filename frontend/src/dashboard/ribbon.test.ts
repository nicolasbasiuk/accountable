import { describe, expect, test } from 'vitest'
import { ribbon } from './ribbon'

const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number)

describe('thickness', () => {
  test('follows the value', () => {
    const { parts } = ribbon([1000, 500, 250, 100, 0], 500, 180)
    expect(parts.map(({ thickness }) => thickness)).toEqual([180, 90, 45, 18, 0])
  })

  test('follows the value when a later stage has more', () => {
    expect(ribbon([100, 200], 500, 180).parts.map(({ thickness }) => thickness)).toEqual([90, 180])
  })

  test('is full when all are equal', () => {
    expect(ribbon([7, 7, 7, 7, 7], 500, 180).parts.map(({ thickness }) => thickness)).toEqual([180, 180, 180, 180, 180])
  })

  test('is nothing when there is nothing', () => {
    expect(ribbon([0, 0, 0, 0, 0], 500, 180).parts.map(({ thickness }) => thickness)).toEqual([0, 0, 0, 0, 0])
  })
})

test('parts sit side by side, with a gap after each but the last', () => {
  const { parts } = ribbon([5, 4, 3, 2, 1], 500, 180)
  expect(parts.map(({ x }) => x)).toEqual([0, 100, 200, 300, 400])
  expect(parts.map(({ width }) => width)).toEqual([97, 97, 97, 97, 100])
  expect(parts.map(({ flatX }) => Math.round(flatX))).toEqual([0, 120, 220, 320, 420])
})

test.each([
  ['falling', [5000, 4000, 3000, 2000, 1000]],
  ['equal', [5, 5, 5, 5, 5]],
  ['zero', [0, 0, 0, 0, 0]],
  ['zero at the end', [5, 4, 0, 0, 0]],
  ['very large', [999_999_999_999, 1, 0, 0, 0]],
])('draws %s values without errors, inside its box', (_what, values) => {
  const { path } = ribbon(values, 1098, 178)
  expect(path).toMatch(/^M.*Z$/)
  expect(path).not.toMatch(/NaN|Infinity|undefined/)
  const all = numbers(path)
  const xs = all.filter((_, index) => index % 2 === 0)
  const ys = all.filter((_, index) => index % 2 === 1)
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...xs)).toBeLessThanOrEqual(1098)
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...ys)).toBeLessThanOrEqual(178)
})
