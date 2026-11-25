// What the deal form fills in, and what it sends (D2, D3).
import type { Contact } from '../contacts/queries'
import { changed, checkYear } from '../shared/checks'
import { stageInfo, type Config, type Stage } from '../shared/config'
import type { PickerGroup } from '../shared/RecordPicker'

/** The fields as the form has them. Numbers are text while they're being typed. */
export type DealValues = {
  name: string
  organization_id: number | null
  contact_id: number | null
  stage: Stage
  value: string
  probability: string
  close_date: string
}

const HIGHEST_VALUE = 999_999_999_999

/** A Won deal is always 100% and a Lost one 0%. */
export const isFixed = (config: Config, stage: Stage) => !stageInfo(config, stage).open

/** What choosing a stage fills in. An open stage leaves the date, unless closing it here had just set it to today. */
export function forStage(config: Config, stage: Stage, closeDate: string, dateBeforeClosing: string | null) {
  const { open, probability } = stageInfo(config, stage)
  return {
    probability: String(probability),
    close_date: open ? (dateBeforeClosing ?? closeDate) : config.today,
  }
}

/** The contact's organization, if none was chosen yet. */
export function organizationFor(contactId: number | null, contacts: Contact[], organizationId: number | null): number | null {
  return organizationId ?? contacts.find(({ id }) => id === contactId)?.organization?.id ?? null
}

/** Everyone, with the chosen organization's contacts first. */
export function contactGroups(contacts: Contact[], organizationId: number | null): PickerGroup[] {
  const item = ({ id, name, organization }: Contact) => ({ value: id, label: name, detail: organization?.name })
  const theirs = contacts.filter(({ organization }) => organizationId !== null && organization?.id === organizationId)
  if (theirs.length === 0) return [{ value: '', items: contacts.map(item) }]
  return [
    { value: `At ${theirs[0]!.organization!.name}`, items: theirs.map(item) },
    { value: 'Other contacts', items: contacts.filter((contact) => !theirs.includes(contact)).map(item) },
  ].filter(({ items }) => items.length > 0)
}

/** 125000 from "125,000" or "$125,000", or undefined if it isn't a whole number. */
export function wholeNumber(text: string): number | undefined {
  const plain = text.replace(/[$,\s]/g, '')
  return /^\d+$/.test(plain) ? Number(plain) : undefined
}

export function checkValue(text: string): true | string {
  if (text.trim() === '') return 'Enter a value.'
  if (text.trim().startsWith('-')) return 'Enter a value of $0 or more.'
  const value = wholeNumber(text)
  if (value === undefined) return 'Enter a whole number of dollars.'
  return value <= HIGHEST_VALUE || `Enter a value of $${HIGHEST_VALUE.toLocaleString('en-US')} or less.`
}

export function checkProbability(text: string): true | string {
  const probability = wholeNumber(text.replace('%', ''))
  return (probability !== undefined && probability <= 100) || 'Enter a probability from 0 to 100.'
}

export function checkCloseDate(config: Config, stage: Stage, closeDate: string): true | string {
  if (!closeDate) return 'Enter a close date.'
  const year = checkYear(closeDate)
  if (year !== true) return year
  const { open, name } = stageInfo(config, stage)
  return open || closeDate <= config.today || `A ${name.toLowerCase()} deal's close date can't be after today.`
}

const asBody = (values: DealValues) => ({
  ...values,
  value: wholeNumber(values.value),
  probability: wholeNumber(values.probability.replace('%', '')),
})

/**
 * What to send: everything for a new deal, only the changes for an edit.
 * With a new stage, its probability and close date always go along. Otherwise setting one back to
 * its first value would look unchanged, and the server would put the stage's own in its place.
 */
export function dealBody(before: DealValues | undefined, after: DealValues): object {
  const body = asBody(after)
  if (!before) return body
  const changes = changed<object>(asBody(before), body)
  if (before.stage === after.stage) return changes
  return { ...changes, stage: body.stage, probability: body.probability, close_date: body.close_date }
}
