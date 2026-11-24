import { describe, expect, test } from 'vitest'
import type { Config, Stage } from '../shared/config'
import { dropAt, moveCard, totals, type Board, type Card, type Column } from './board'

const config: Config = {
  today: '2026-11-24',
  now: '2026-11-24T12:00:00Z',
  stages: [
    { key: 'new', name: 'New', probability: 10, open: true },
    { key: 'qualified', name: 'Qualified', probability: 25, open: true },
    { key: 'proposal', name: 'Proposal', probability: 50, open: true },
    { key: 'negotiation', name: 'Negotiation', probability: 75, open: true },
    { key: 'won', name: 'Won', probability: 100, open: false },
    { key: 'lost', name: 'Lost', probability: 0, open: false },
  ],
}

const card = (id: number, more: Partial<Card> = {}): Card => ({
  id, name: `Deal ${id}`, organization: null, value: 10_000, probability: 10, close_date: '2027-01-14', days_late: 0, ...more,
})
const column = (stage: Stage, cards: Card[]): Column => ({ stage, cards, ...totals(cards) })

const columns = [
  column('new', [card(1), card(2, { value: 5_001, probability: 33 }), card(3)]),
  column('qualified', []),
  column('proposal', [card(4, { probability: 50 }), card(5, { probability: 50, close_date: '2026-11-14', days_late: 10 })]),
  column('negotiation', [card(6, { probability: 80 })]),
  column('won', [card(7, { probability: 100, close_date: '2026-11-10' })]),
  column('lost', [card(8, { probability: 0, close_date: '2026-11-10' })]),
]
const board: Board = { ...totals(columns.slice(0, 4).flatMap(({ cards }) => cards)), columns }

const move = (id: number, stage: Stage, before_id: number | null = null) => moveCard(board, { id, stage, before_id }, config)
const ids = (of: Board, stage: Stage) => of.columns.find((one) => one.stage === stage)!.cards.map(({ id }) => id)
const find = (of: Board, id: number) => of.columns.flatMap(({ cards }) => cards).find((one) => one.id === id)!

describe('moving a card', () => {
  test('to another column, above a card or at the end', () => {
    expect(ids(move(1, 'proposal', 4), 'proposal')).toEqual([1, 4, 5])
    expect(ids(move(1, 'proposal', 5), 'proposal')).toEqual([4, 1, 5])
    expect(ids(move(1, 'proposal'), 'proposal')).toEqual([4, 5, 1])
    expect(ids(move(1, 'proposal'), 'new')).toEqual([2, 3])
  })

  test('within a column, which changes nothing but the order', () => {
    expect(ids(move(1, 'new', 3), 'new')).toEqual([2, 1, 3])
    expect(ids(move(3, 'new', 1), 'new')).toEqual([3, 1, 2])
    expect(ids(move(1, 'new'), 'new')).toEqual([2, 3, 1])
    const after = move(2, 'new')
    expect(find(after, 2)).toEqual(find(board, 2))
    expect([after.count, after.value, after.expected]).toEqual([board.count, board.value, board.expected])
  })

  test('into an empty column', () => {
    expect(ids(move(1, 'qualified'), 'qualified')).toEqual([1])
  })

  test("takes the stage's probability", () => {
    expect(find(move(2, 'qualified'), 2)).toMatchObject({ probability: 25, close_date: '2027-01-14' })
    expect(find(move(6, 'new'), 6).probability).toBe(10)
  })

  test('to Won and Lost takes today, and is not late', () => {
    expect(find(move(5, 'won'), 5)).toMatchObject({ probability: 100, close_date: '2026-11-24', days_late: 0 })
    expect(find(move(5, 'lost'), 5)).toMatchObject({ probability: 0, close_date: '2026-11-24', days_late: 0 })
  })

  test('reopened keeps its date, and may be late', () => {
    expect(find(move(7, 'proposal'), 7)).toMatchObject({ probability: 50, close_date: '2026-11-10', days_late: 14 })
    expect(find(move(8, 'new'), 8)).toMatchObject({ probability: 10, close_date: '2026-11-10', days_late: 14 })
  })

  test('stays late between open stages', () => {
    expect(find(move(5, 'negotiation'), 5).days_late).toBe(10)
  })

  test('twice is the same as once', () => {
    const once = move(1, 'proposal', 5)
    expect(moveCard(once, { id: 1, stage: 'proposal', before_id: 5 }, config)).toEqual(once)
  })

  test('beside a card that has gone, goes to the end', () => {
    expect(ids(move(1, 'proposal', 99), 'proposal')).toEqual([4, 5, 1])
  })

  test('that has gone changes nothing', () => {
    expect(move(99, 'won')).toBe(board)
  })

  test('leaves the first board as it was', () => {
    const before = structuredClone(board)
    move(1, 'won')
    expect(board).toEqual(before)
  })
})

describe('totals', () => {
  test('of some cards', () => {
    expect(totals([])).toEqual({ count: 0, value: 0, expected: 0 })
    expect(totals([card(1), card(2, { value: 5_001, probability: 33 })])).toEqual({ count: 2, value: 15_001, expected: 2650.33 })
  })

  test('change in both columns and on the board', () => {
    const after = move(1, 'won')
    const of = (stage: Stage) => after.columns.find((one) => one.stage === stage)!
    expect(of('new')).toMatchObject({ count: 2, value: 15_001 })
    expect(of('won')).toMatchObject({ count: 2, value: 20_000, expected: 20_000 })
    // Only open deals count on the board.
    expect(after).toMatchObject({ count: board.count - 1, value: board.value - 10_000, expected: board.expected - 1_000 })
  })
})

describe('dropping', () => {
  const drop = (id: number, from: [Stage, number], to: [Stage, number]) =>
    dropAt(board, id, { stage: from[0], place: from[1] }, { stage: to[0], place: to[1] })

  test('names the card it goes above', () => {
    expect(drop(1, ['new', 0], ['proposal', 0])).toEqual({ id: 1, stage: 'proposal', before_id: 4 })
    expect(drop(1, ['new', 0], ['proposal', 1])).toEqual({ id: 1, stage: 'proposal', before_id: 5 })
    expect(drop(1, ['new', 0], ['proposal', 2])).toEqual({ id: 1, stage: 'proposal', before_id: null })
    expect(drop(1, ['new', 0], ['qualified', 0])).toEqual({ id: 1, stage: 'qualified', before_id: null })
  })

  test('within a column, counts the places without the card itself', () => {
    expect(drop(1, ['new', 0], ['new', 1])).toEqual({ id: 1, stage: 'new', before_id: 3 })
    expect(drop(1, ['new', 0], ['new', 2])).toEqual({ id: 1, stage: 'new', before_id: null })
    expect(drop(3, ['new', 2], ['new', 0])).toEqual({ id: 3, stage: 'new', before_id: 1 })
  })

  test('where it was is no move', () => {
    expect(drop(1, ['new', 0], ['new', 0])).toBeUndefined()
  })
})
