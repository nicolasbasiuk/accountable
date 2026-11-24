// Short messages at the bottom of the screen, some with Undo. Messages.tsx shows them.
import { Toast } from '@base-ui/react/toast'

export const messages = Toast.createToastManager()

const SECONDS = 6
const UNDO_SECONDS = 10
const undoOfMoves = new Set<string>()

/** Says that something was done. */
export function showMessage(text: string, undo?: () => void): void {
  add(text, undo)
}

/** Says where a card went. It goes when anything else is changed (P8). */
export function showMove(text: string, undo: () => void): void {
  undoOfMoves.add(add(text, undo))
}

/** Says what went wrong. */
export function showProblem(text: string): void {
  messages.add({ title: text, type: 'problem', priority: 'high', timeout: UNDO_SECONDS * 1000 })
}

export function closeUndoMessages(): void {
  for (const id of undoOfMoves) messages.close(id)
  undoOfMoves.clear()
}

function add(text: string, undo?: () => void): string {
  const id: string = messages.add({
    title: text,
    timeout: (undo ? UNDO_SECONDS : SECONDS) * 1000,
    onRemove: () => undoOfMoves.delete(id),
    ...(undo && {
      actionProps: {
        children: 'Undo',
        onClick: () => {
          messages.close(id)
          undo()
        },
      },
    }),
  })
  return id
}
