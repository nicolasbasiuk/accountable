import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { contactsQuery } from '../contacts/queries'
import { organizationsQuery } from '../organizations/queries'
import { required } from '../shared/checks'
import { stageInfo, useConfig, type Stage } from '../shared/config'
import { DateField, SelectField, TextField } from '../shared/fields'
import { FormDialog } from '../shared/FormDialog'
import { showMessage } from '../shared/messageStore'
import { RecordPicker } from '../shared/RecordPicker'
import { useSaveDeal, type Deal } from './queries'
import { StageName } from './StageName'
import { STAGE_ORDER } from './stages'
import { checkCloseDate, checkProbability, checkValue, contactGroups, dealBody, forStage, isFixed, organizationFor, type DealValues } from './suggestions'

type Preset = { stage?: Stage; organization_id?: number | null; contact_id?: number | null }

export function DealForm({ deal, preset = {}, onClosed }: { deal?: Deal; preset?: Preset; onClosed: () => void }) {
  const config = useConfig()
  const save = useSaveDeal(deal?.id)
  const contacts = useQuery(contactsQuery)
  const organizations = useQuery(organizationsQuery)
  const dateBeforeClosing = useRef<string | null>(null)

  const stage = preset.stage ?? 'new'
  const defaultValues: DealValues = deal
    ? {
        name: deal.name,
        organization_id: deal.organization?.id ?? null,
        contact_id: deal.contact?.id ?? null,
        stage: deal.stage,
        value: deal.value.toLocaleString('en-US'),
        probability: String(deal.probability),
        close_date: deal.close_date,
      }
    : {
        name: '',
        organization_id: preset.organization_id ?? null,
        contact_id: preset.contact_id ?? null,
        stage,
        value: '',
        ...forStage(config, stage, '', null),
      }
  // The form keeps what it started with, also when the deal is loaded again behind it.
  const first = useRef(defaultValues).current
  const form = useForm<DealValues>({ defaultValues: first })
  const { errors } = form.formState
  const [chosenStage, organizationId] = form.watch(['stage', 'organization_id'])
  if (contacts.isPending || organizations.isPending) return null

  const people = contacts.data ?? []
  const items = (organizations.data ?? []).map(({ id, name }) => ({ value: id, label: name }))

  function chooseStage(next: Stage) {
    const { stage: before, close_date } = form.getValues()
    if (next === before) return
    if (isFixed(config, next) && !isFixed(config, before)) dateBeforeClosing.current = close_date
    const closedHere = isFixed(config, before) && close_date === config.today ? dateBeforeClosing.current : null
    const filled = forStage(config, next, close_date, closedHere)
    const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted }
    form.setValue('stage', next, options)
    form.setValue('probability', filled.probability, options)
    form.setValue('close_date', filled.close_date, options)
  }

  function chooseContact(next: number | null) {
    const filled = organizationFor(next, people, form.getValues('organization_id'))
    form.setValue('contact_id', next, { shouldDirty: true })
    form.setValue('organization_id', filled, { shouldDirty: true })
  }

  return (
    <FormDialog
      title={deal ? 'Edit deal' : 'Add deal'}
      submit={deal ? 'Save changes' : 'Add deal'}
      form={form}
      onSave={async (values) => {
        await save.mutateAsync(dealBody(deal && first, values))
        if (!deal) showMessage(`Added ${values.name.trim()}.`)
      }}
      onClosed={onClosed}
    >
      <TextField label="Name" className="col-span-2" error={errors.name?.message} {...form.register('name', required('Enter a name.'))} />
      <Controller
        control={form.control}
        name="organization_id"
        render={({ field, fieldState }) => (
          <RecordPicker
            label="Organization"
            what="organization"
            groups={[{ value: '', items }]}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="contact_id"
        render={({ field, fieldState }) => (
          <RecordPicker
            label="Main contact"
            what="contact"
            groups={contactGroups(people, organizationId)}
            value={field.value}
            onChange={chooseContact}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="stage"
        render={({ field, fieldState }) => (
          <SelectField
            label="Stage"
            options={STAGE_ORDER.map((key) => ({ value: key, label: stageInfo(config, key).name, show: <StageName stage={key} /> }))}
            value={field.value}
            onChange={(next) => chooseStage(next as Stage)}
            error={fieldState.error?.message}
          />
        )}
      />
      <TextField
        label="Value"
        prefix="$"
        inputMode="numeric"
        error={errors.value?.message}
        {...form.register('value', { validate: checkValue })}
      />
      <TextField
        label="Probability (%)"
        inputMode="numeric"
        readOnly={isFixed(config, chosenStage)}
        error={errors.probability?.message}
        {...form.register('probability', { validate: checkProbability })}
      />
      <DateField
        label="Close date"
        max={isFixed(config, chosenStage) ? config.today : undefined}
        error={errors.close_date?.message}
        {...form.register('close_date', { validate: (value, values) => checkCloseDate(config, values.stage, value) })}
      />
    </FormDialog>
  )
}
