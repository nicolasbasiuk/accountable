import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { changed, required } from '../shared/checks'
import { SuggestField, TextArea, TextField } from '../shared/fields'
import { FormDialog } from '../shared/FormDialog'
import { showMessage } from '../shared/messageStore'
import { organizationsQuery, useSaveOrganization } from './queries'
import { checkWebsite } from './website'

type Existing = { id: number; name: string; website: string | null; industry: string | null; notes: string | null }

export function OrganizationForm({ organization, onClosed }: { organization?: Existing; onClosed: () => void }) {
  const save = useSaveOrganization(organization?.id)
  const others = useQuery(organizationsQuery)
  const defaultValues = {
    name: organization?.name ?? '',
    website: organization?.website ?? '',
    industry: organization?.industry ?? '',
    notes: organization?.notes ?? '',
  }
  const form = useForm({ defaultValues })
  const { errors } = form.formState
  const industries = [...new Set((others.data ?? []).flatMap(({ industry }) => industry ?? []))].sort()

  return (
    <FormDialog
      title={organization ? 'Edit organization' : 'Add organization'}
      submit={organization ? 'Save changes' : 'Add organization'}
      form={form}
      onSave={async (values) => {
        await save.mutateAsync(organization ? changed(defaultValues, values) : values)
        if (!organization) showMessage(`Added ${values.name.trim()}.`)
      }}
      onClosed={onClosed}
    >
      <TextField label="Name" className="col-span-2" error={errors.name?.message} {...form.register('name', required('Enter a name.'))} />
      <TextField label="Website" optional error={errors.website?.message} {...form.register('website', { validate: checkWebsite })} />
      <Controller
        control={form.control}
        name="industry"
        render={({ field, fieldState }) => (
          <SuggestField label="Industry" optional suggestions={industries} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <TextArea label="Notes" optional className="col-span-2" error={errors.notes?.message} {...form.register('notes')} />
    </FormDialog>
  )
}
