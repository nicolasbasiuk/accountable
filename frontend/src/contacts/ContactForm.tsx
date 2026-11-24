import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { organizationsQuery } from '../organizations/queries'
import { changed, required } from '../shared/checks'
import { ChoiceField, TextField } from '../shared/fields'
import { FormDialog } from '../shared/FormDialog'
import { showMessage } from '../shared/messageStore'
import { RecordPicker } from '../shared/RecordPicker'
import { useSaveContact, type Contact, type Status } from './queries'
import { STATUS_NAMES, STATUSES, StatusName } from './StatusName'

type Props = { contact?: Omit<Contact, 'last_activity' | 'next_follow_up'>; organizationId?: number; onClosed: () => void }

export function checkEmail(text: string): true | string {
  const email = text.trim()
  return email === '' || /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email) || 'Enter an email address, such as name@example.com.'
}

export function ContactForm({ contact, organizationId, onClosed }: Props) {
  const save = useSaveContact(contact?.id)
  const organizations = useQuery(organizationsQuery)
  const defaultValues = {
    name: contact?.name ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    job_title: contact?.job_title ?? '',
    organization_id: (contact ? contact.organization?.id : organizationId) ?? null,
    status: (contact?.status ?? 'lead') as Status,
  }
  const form = useForm({ defaultValues })
  const { errors } = form.formState
  if (organizations.isPending) return null
  const items = (organizations.data ?? []).map(({ id, name }) => ({ value: id, label: name }))

  return (
    <FormDialog
      title={contact ? 'Edit contact' : 'Add contact'}
      submit={contact ? 'Save changes' : 'Add contact'}
      form={form}
      onSave={async (values) => {
        await save.mutateAsync(contact ? changed(defaultValues, values) : values)
        if (!contact) showMessage(`Added ${values.name.trim()}.`)
      }}
      onClosed={onClosed}
    >
      <TextField label="Name" error={errors.name?.message} {...form.register('name', required('Enter a name.'))} />
      <TextField label="Job title" optional error={errors.job_title?.message} {...form.register('job_title')} />
      <TextField label="Email" optional error={errors.email?.message} {...form.register('email', { validate: checkEmail })} />
      <TextField label="Phone" optional error={errors.phone?.message} {...form.register('phone')} />
      <Controller
        control={form.control}
        name="organization_id"
        render={({ field, fieldState }) => (
          <RecordPicker
            label="Organization"
            what="organization"
            className="col-span-2"
            groups={[{ value: '', items }]}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <ChoiceField
        label="Status"
        className="col-span-2"
        options={STATUSES.map((status) => ({ value: status, label: STATUS_NAMES[status], show: <StatusName status={status} /> }))}
        error={errors.status?.message}
        {...form.register('status')}
      />
    </FormDialog>
  )
}
