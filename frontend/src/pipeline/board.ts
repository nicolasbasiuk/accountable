// The board, and what a move changes on it before the server answers (P5, P6).
import { stageInfo, type Config, type Stage } from '../shared/config'
import { daysBetween } from '../shared/format'

export type Card = {
  id: number
  name: string
  organization: string | null
  value: number
  probability: number
  close_date: string
  days_late: number
}

export type Totals = { count: number; value: number; expected: number }

export type Column = Totals & { stage: Stage; cards: Card[] }

export type Board = Totals & { columns: Column[] }

/** Puts a card above another one, or at the end of a column. */
export type Move = { id: number; stage: Stage; before_id: number | null }

export function totals(cards: Card[]): Totals {
  return {
    count: cards.length,
    value: cards.reduce((sum, card) => sum + card.value, 0),
    expected: cards.reduce((sum, card) => sum + card.value * card.probability, 0) / 100,
  }
}

export function moveCard(board: Board, move: Move, config: Config): Board {
  const from = board.columns.find(({ cards }) => cards.some(({ id }) => id === move.id))
  const card = from?.cards.find(({ id }) => id === move.id)
  if (!from || !card) return board // It has gone.

  const moved = from.stage === move.stage ? card : atStage(card, move.stage, config)
  const columns = board.columns.map((column) => {
    const cards = column.cards.filter(({ id }) => id !== move.id)
    if (column.stage === move.stage) {
      const place = cards.findIndex(({ id }) => id === move.before_id)
      cards.splice(place < 0 ? cards.length : place, 0, moved)
    }
    return { ...column, cards, ...totals(cards) }
  })
  const open = columns.filter(({ stage }) => stageInfo(config, stage).open)
  return { ...totals(open.flatMap(({ cards }) => cards)), columns }
}

/** The stage's probability, today's date when it closes, and whether it's late. As the server does. */
function atStage(card: Card, stage: Stage, config: Config): Card {
  const { open, probability } = stageInfo(config, stage)
  const close_date = open ? card.close_date : config.today
  return { ...card, probability, close_date, days_late: open ? Math.max(0, daysBetween(close_date, config.today)) : 0 }
}

/** The move that drops a card at a place, or undefined if it's where it was. */
export function dropAt(board: Board, id: number, from: { stage: Stage; place: number }, to: { stage: Stage; place: number }): Move | undefined {
  if (from.stage === to.stage && from.place === to.place) return undefined
  const others = board.columns.find(({ stage }) => stage === to.stage)!.cards.filter((card) => card.id !== id)
  return { id, stage: to.stage, before_id: others[to.place]?.id ?? null }
}
