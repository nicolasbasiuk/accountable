import { AlertDialog } from '@base-ui/react/alert-dialog'
import type { ReactNode } from 'react'

export const BACKDROP =
  'fixed inset-0 bg-midnight/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0'
export const DIALOG =
  'max-h-[calc(100vh-3rem)] overflow-y-auto rounded-panel bg-white p-7 shadow-lifted outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0'
export const VIEWPORT = 'fixed inset-0 z-30 grid place-items-center p-6'

type QuestionProps = {
  open: boolean
  onClose: () => void
  onClosed?: () => void
  title: string
  children: ReactNode
  /** The buttons, the safe one first. */
  actions: ReactNode
}

/** A question that has to be answered before going on. */
export function Question({ open, onClose, onClosed, title, children, actions }: QuestionProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(next) => !next && onClosed?.()}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={BACKDROP} />
        <AlertDialog.Viewport className={VIEWPORT}>
          <AlertDialog.Popup className={`${DIALOG} w-full max-w-110`}>
            <AlertDialog.Title className="text-xl leading-tight font-semibold tracking-[-0.01em] wrap-anywhere">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description render={<div />} className="mt-2 text-muted">
              {children}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">{actions}</div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
