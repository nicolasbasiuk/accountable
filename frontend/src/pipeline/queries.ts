import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { explain, get, isConflict, post } from '../shared/client'
import { stageInfo, useConfig, type Stage } from '../shared/config'
import { showMove, showProblem } from '../shared/messageStore'
import { CARD_MOVE } from '../shared/queryClient'
import { moveCard, type Board, type Move } from './board'

export const boardQuery = queryOptions({ queryKey: ['board'], queryFn: () => get<Board>('/board') })

// Moves that the board from the server may not have yet. They're shown on top of it, so whatever
// is loaded meanwhile can't put a card back. Kept here, so they outlive the page, and changed at
// once, because a card would jump back if the screen were to change only a moment after the drop.
let moves: Move[] = []
const watchers = new Set<() => void>()

function setMoves(next: Move[]) {
  moves = next
  watchers.forEach((watcher) => watcher())
}

function watch(watcher: () => void) {
  watchers.add(watcher)
  return () => void watchers.delete(watcher)
}

export const useUnsavedMoves = () => useSyncExternalStore(watch, () => moves)

type StageChange = { id: number; from_stage: Stage; to_stage: Stage }

type NamedMove = { move: Move; name: string }

/** Sends moves one after another (they share a scope). Shows each at once, and puts it back if it fails. */
export function useMoveCard() {
  const client = useQueryClient()
  const config = useConfig()
  const undo = useUndo()

  const mutation = useMutation({
    mutationKey: CARD_MOVE,
    scope: { id: CARD_MOVE[0]! },
    mutationFn: ({ move: { id, ...to } }: NamedMove) => post<{ stage_change: StageChange | null }>(`/deals/${id}/move`, to),
    onSuccess: ({ stage_change }, { move, name }) => {
      client.setQueryData(boardQuery.queryKey, (board) => board && moveCard(board, move, config))
      if (!stage_change) return
      showMove(`Moved ${name} to ${stageInfo(config, stage_change.to_stage).name}.`, () => undo.mutate({ id: move.id, stage_change_id: stage_change.id }))
    },
    onError: (error, { move }) => {
      setMoves(moves.filter((other) => other !== move))
      showProblem(isConflict(error) ? explain(error) : `Not moved. ${explain(error)}`)
    },
    // Everything has been loaded again by now, unless another move is waiting.
    onSettled: () => {
      if (client.isMutating({ mutationKey: CARD_MOVE }) <= 1) setMoves([])
    },
  })

  return (move: Move, name: string) => {
    setMoves([...moves, move])
    mutation.mutate({ move, name })
  }
}

/** Undoes a card's move to another column (P8). */
function useUndo() {
  const client = useQueryClient()
  return useMutation({
    scope: { id: CARD_MOVE[0]! },
    mutationFn: ({ id, stage_change_id }: { id: number; stage_change_id: number }) => post(`/deals/${id}/undo`, { stage_change_id }),
    onError: (error) => {
      showProblem(isConflict(error) ? explain(error) : `Not undone. ${explain(error)}`)
      return client.invalidateQueries()
    },
  })
}
