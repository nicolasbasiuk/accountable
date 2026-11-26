import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { changed, checkYear, required } from '../shared/checks'
import { configQuery, type Config } from '../shared/config'
import { ChoiceField, DateField, TextArea } from '../shared/fields'
import { fromField, toField } from '../shared/format'
import { FormDialog } from '../shared/FormDialog'
import { useSaveActivity, type ActivityEntry, type ActivityType } from './queries'

const TYPES: { value: ActivityType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
]

/** What an activity is logged on. */
export type On = { contact_id: number } | { deal_id: number }

type Props = { activity: ActivityEntry; on?: undefined } | { activity?: undefined; on: On }

/** The server's time now, from its "now" as read at `readAt`. Read when checking, never while rendering. */
function serverNow(now: string, readAt: number) {
  return new Date(now).getTime() + Date.now() - readAt
}

export function ActivityForm(props: Props & { onClosed: () => void }) {
  // "Now" is the server's, as it is when the form opens.
  const { data, dataUpdatedAt, isFetchedAfterMount } = useQuery({ ...configQuery, refetchOnMount: 'always' })
  return isFetchedAfterMount && data && <Shown {...props} config={data} readAt={dataUpdatedAt} />
}

function Shown({
  activity,
  on,
  config,
  readAt,
  onClosed,
}: Props & { config: Config; readAt: number; onClosed: () => void }) {
  const save = useSaveActivity(activity?.id)
  const defaultValues = {
    type: (activity?.type ?? 'note') as ActivityType,
    description: activity?.description ?? '',
    happened_at: toField(activity?.at ?? config.now),
    follow_up_on: activity?.follow_up_on ?? '',
  }
  // What the form started with, also when the entry is loaded again behind it.
  const [first] = useState(defaultValues)
  const form = useForm({ defaultValues: first })
  const { errors } = form.formState

  function checkTime(text: string): true | string {
    if (!text) return 'Enter a date and time.'
    const year = checkYear(text)
    if (year !== true) return year
    return new Date(text).getTime() <= serverNow(config.now, readAt) || "This can't be in the future."
  }

  return (
    <FormDialog
      title={activity ? 'Edit activity' : 'Log activity'}
      submit={activity ? 'Save changes' : 'Log activity'}
      form={form}
      onSave={(values) => {
        // The time is sent only if it was changed, so that "now" is the server's.
        const { happened_at, follow_up_on, ...others } = changed(first, values)
        return save.mutateAsync({
          ...(activity ? others : { ...on, type: values.type, description: values.description }),
          ...(follow_up_on !== undefined && { follow_up_on: follow_up_on || null }),
          ...(happened_at && { happened_at: fromField(happened_at) }),
        })
      }}
      onClosed={onClosed}
    >
      <ChoiceField
        label="Type"
        className="col-span-2"
        options={TYPES}
        error={errors.type?.message}
        {...form.register('type')}
      />
      <TextArea
        label="Description"
        className="col-span-2"
        error={errors.description?.message}
        {...form.register('description', required('Enter a description.'))}
      />
      <DateField
        label="Happened"
        type="datetime-local"
        max={toField(config.now)}
        error={errors.happened_at?.message}
        {...form.register('happened_at', { validate: checkTime })}
      />
      <DateField
        label="Follow up on"
        optional
        error={errors.follow_up_on?.message}
        {...form.register('follow_up_on', { validate: checkYear })}
      />
    </FormDialog>
  )
}
