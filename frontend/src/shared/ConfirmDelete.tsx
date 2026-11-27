import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from './buttons'
import { explain, get, remove } from './client'
import { Question } from './dialogs'
import { plural } from './format'
import { showMessage } from './messageStore'

type What = 'organization' | 'contact' | 'deal' | 'activity'

/** What deleting a record does to others. Only the numbers that apply to its kind are there. */
export type Numbers = { contacts?: number; deals?: number; activities?: number; follow_ups?: number }

const LEFT_WITHOUT = { organization: 'organization', contact: 'main contact' }

/** What happens to the others, leaving out what doesn't apply (X1). */
export function consequences(what: What, numbers: Numbers): string[] {
  const { contacts = 0, deals = 0, activities = 0, follow_ups = 0 } = numbers
  if (what === 'activity') return follow_ups ? ['Its follow-up is deleted too.'] : []

  const sentences = []
  const kept = [contacts && plural(contacts, 'contact'), deals && plural(deals, 'deal')].filter(Boolean)
  if (kept.length) {
    const verb = contacts + deals === 1 ? 'is' : 'are'
    sentences.push(`${kept.join(' and ')} ${verb} kept, with no ${LEFT_WITHOUT[what as 'organization' | 'contact']}.`)
  }
  if (activities === 1) {
    sentences.push(`1 activity is deleted${follow_ups ? ', with a follow-up still to do' : ''}.`)
  } else if (activities) {
    sentences.push(
      `${activities} activities are deleted${follow_ups ? `, ${follow_ups} with a follow-up still to do` : ''}.`,
    )
  }
  return sentences
}

type Props = {
  what: What
  name: string
  /** Its address in the API, such as /deals/7. */
  path: string
  /** For an activity, which has nothing to ask the server. */
  numbers?: Numbers
  /** Leaves the record's own page, before everything on screen is asked for again. */
  onDeleted?: () => Promise<void> | void
  onClosed: () => void
}

export function ConfirmDelete({ what, name, path, numbers, onDeleted, onClosed }: Props) {
  const client = useQueryClient()
  const [open, setOpen] = useState(true)
  const numbersKey = ['deletion', path]
  const deletion = useMutation({
    mutationFn: () => remove(path),
    onSuccess: async () => {
      setOpen(false)
      // Or the refresh that follows would ask about a record that's gone.
      client.removeQueries({ queryKey: numbersKey })
      showMessage(`Deleted ${name}.`)
      await onDeleted?.()
    },
  })
  const asked = useQuery({
    queryKey: numbersKey,
    queryFn: () => get<Numbers>(`${path}/deletion`),
    gcTime: 0,
    enabled: !numbers && (deletion.isIdle || deletion.isError),
  })
  const known = numbers ?? asked.data
  const problem = deletion.error ?? asked.error

  return (
    <Question
      open={open}
      onClose={() => !deletion.isPending && setOpen(false)}
      onClosed={onClosed}
      title={`Delete ${name}?`}
      actions={
        <>
          <Button onClick={() => setOpen(false)} disabled={deletion.isPending}>
            Cancel
          </Button>
          <Button look="danger" onClick={() => !deletion.isPending && deletion.mutate()} disabled={!known}>
            Delete {what}
          </Button>
        </>
      }
    >
      {known && <p>{[...consequences(what, known), "This can't be undone."].join(' ')}</p>}
      {problem && (
        <p role="alert" className="mt-3 font-medium text-coral-text">
          {deletion.error ? 'Not deleted. ' : ''}
          {explain(problem)}
        </p>
      )}
    </Question>
  )
}
