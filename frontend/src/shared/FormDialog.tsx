import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { useBeforeUnload, useBlocker } from 'react-router'
import { Button } from './buttons'
import { ApiError, explain } from './client'
import { BACKDROP, DIALOG, Question, VIEWPORT } from './dialogs'

type Props<V extends FieldValues> = {
  title: string
  /** The main button, such as "Add deal". */
  submit: string
  form: UseFormReturn<V>
  /** Saves, or throws what went wrong. */
  onSave: (values: V) => Promise<unknown>
  /** Called once it has gone, to take it off the page. */
  onClosed: () => void
  children: ReactNode
}

/** A form over the page. Open from the moment it's on the page. */
export function FormDialog<V extends FieldValues>({ title, submit, form, onSave, onClosed, children }: Props<V>) {
  const [open, setOpen] = useState(true)
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState('')
  const { isDirty, isSubmitting } = form.formState
  const unsaved = open && isDirty

  // Leaving the page closes the form too: with the browser's Back, or out of Accountable, where only the browser can ask.
  const leaving = useBlocker(
    ({ currentLocation, nextLocation }) => unsaved && currentLocation.pathname !== nextLocation.pathname,
  )
  useBeforeUnload((event) => {
    if (unsaved) event.preventDefault()
  })
  useEffect(() => {
    if (isSubmitting && leaving.state === 'blocked') leaving.reset() // Nothing closes it while it's being saved.
  }, [isSubmitting, leaving])

  const save = form.handleSubmit(async (values) => {
    setProblem('')
    try {
      await onSave(values)
      setOpen(false)
    } catch (error) {
      showProblem(error)
    }
  })

  function showProblem(error: unknown) {
    const fields = error instanceof ApiError ? Object.entries(error.fields) : []
    const known = fields.filter(([field]) => field in form.getValues())
    for (const [field, message] of known) form.setError(field as Path<V>, { message })
    if (known.length === 0) setProblem(explain(error))
  }

  function onSubmit(event: FormEvent) {
    // A form can be inside the page of another one, as React sees it.
    event.stopPropagation()
    event.preventDefault()
    if (!isSubmitting) void save()
  }

  function close() {
    if (isSubmitting) return
    if (isDirty) setAsking(true)
    else setOpen(false)
  }

  function keepEditing() {
    setAsking(false)
    leaving.reset?.()
  }

  function discard() {
    setAsking(false)
    setOpen(false)
    leaving.proceed?.()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => !next && close()}
      onOpenChangeComplete={(next) => !next && onClosed()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={BACKDROP} />
        <Dialog.Viewport className={VIEWPORT}>
          <Dialog.Popup className={`${DIALOG} w-full max-w-150`}>
            <Dialog.Title className="mb-5 text-xl font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
            <form noValidate onSubmit={onSubmit}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4.5">{children}</div>
              {problem && (
                <p role="alert" className="mt-5 rounded-control bg-page px-4 py-3 font-medium text-coral-text">
                  Not saved. {problem}
                </p>
              )}
              <div className="mt-7 flex justify-end gap-3">
                <Dialog.Close render={<Button />}>Cancel</Dialog.Close>
                <Button type="submit" look="main" aria-disabled={isSubmitting}>
                  {isSubmitting ? 'Saving' : submit}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
      <Question
        open={asking || (leaving.state === 'blocked' && !isSubmitting)}
        onClose={keepEditing}
        title="Discard your changes?"
        actions={
          <>
            <Button onClick={keepEditing}>Keep editing</Button>
            <Button look="danger" onClick={discard}>
              Discard changes
            </Button>
          </>
        }
      >
        What you entered has not been saved.
      </Question>
    </Dialog.Root>
  )
}
