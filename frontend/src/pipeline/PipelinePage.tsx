import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DealForm } from '../deals/DealForm'
import { AddButton } from '../shared/buttons'
import { useConfig, type Stage } from '../shared/config'
import { money } from '../shared/format'
import { Page } from '../shared/panels'
import { Loaded } from '../shared/states'
import { dropAt, moveCard, type Board } from './board'
import { PipelineColumn } from './PipelineColumn'
import { boardQuery, useMoveCard, useUnsavedMoves } from './queries'

export function PipelinePage() {
  const query = useQuery(boardQuery)
  return <Loaded query={query}>{(board) => <Shown saved={board} />}</Loaded>
}

function Shown({ saved }: { saved: Board }) {
  const config = useConfig()
  const moves = useUnsavedMoves()
  const move = useMoveCard()
  // The board as it was when a card was picked up. New data waits until it's dropped.
  const [held, setHeld] = useState<Board | null>(null)
  const [adding, setAdding] = useState<Stage | null>(null)
  const board = held ?? moves.reduce((shown, one) => moveCard(shown, one, config), saved)

  function drop({ draggableId, source, destination }: DropResult) {
    setHeld(null)
    if (!destination) return
    const id = Number(draggableId)
    const dropped = dropAt(
      board,
      id,
      { stage: source.droppableId as Stage, place: source.index },
      { stage: destination.droppableId as Stage, place: destination.index },
    )
    const card = board.columns.flatMap(({ cards }) => cards).find((one) => one.id === id)
    if (dropped && card) move(dropped, card.name)
  }

  return (
    <Page
      title="Pipeline"
      fill
      under={
        <p className="mt-1.5 flex items-baseline gap-8 text-muted">
          <BoardFigure value={String(board.count)} label={board.count === 1 ? 'open deal' : 'open deals'} />
          <BoardFigure value={money(board.value)} label="open value" />
          <BoardFigure value={money(board.expected)} label="expected" />
        </p>
      }
      action={<AddButton onClick={() => setAdding('new')}>Add deal</AddButton>}
    >
      <DragDropContext onBeforeCapture={() => setHeld(board)} onDragEnd={drop}>
        <div className="-mb-5 grid min-h-0 flex-1 grid-cols-6 gap-2.5">
          {board.columns.map((column) => (
            <PipelineColumn key={column.stage} column={column} onAdd={() => setAdding(column.stage)} />
          ))}
        </div>
      </DragDropContext>
      {adding && <DealForm preset={{ stage: adding }} onClosed={() => setAdding(null)} />}
    </Page>
  )
}

function BoardFigure({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="num mr-[3px] text-[17px] font-semibold tracking-[-0.02em] text-ink">{value}</span> {label}
    </span>
  )
}
