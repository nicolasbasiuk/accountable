import { describe, expect, test } from 'vitest'
import type { Contact } from '../contacts/queries'
import type { Config } from '../shared/config'
import {
  checkCloseDate,
  checkProbability,
  checkValue,
  contactGroups,
  dealBody,
  forStage,
  isFixed,
  organizationFor,
  wholeNumber,
  type DealValues,
} from './suggestions'

const config: Config = {
  today: '2026-11-24',
  now: '2026-11-24T12:00:00Z',
  stages: [
    { key: 'new', name: 'New', probability: 10, open: true },
    { key: 'qualified', name: 'Qualified', probability: 25, open: true },
    { key: 'proposal', name: 'Proposal', probability: 50, open: true },
    { key: 'negotiation', name: 'Negotiation', probability: 75, open: true },
    { key: 'won', name: 'Won', probability: 100, open: false },
    { key: 'lost', name: 'Lost', probability: 0, open: false },
  ],
}

const contact = (id: number, name: string, organization: { id: number; name: string } | null) =>
  ({ id, name, organization }) as Contact
const upland = { id: 1, name: 'Upland Water' }
const people = [
  contact(1, 'Adam', null),
  contact(2, 'Beth', upland),
  contact(3, 'Carl', { id: 2, name: 'Verity' }),
  contact(4, 'Dina', upland),
]

describe('choosing a stage', () => {
  test('fills in its usual probability, and leaves an open deal its date', () => {
    expect(forStage(config, 'proposal', '2027-01-14', null)).toEqual({ probability: '50', close_date: '2027-01-14' })
    expect(forStage(config, 'new', '', null)).toEqual({ probability: '10', close_date: '' })
  })

  test('sets the date to today for Won and Lost', () => {
    expect(forStage(config, 'won', '2027-01-14', null)).toEqual({ probability: '100', close_date: '2026-11-24' })
    expect(forStage(config, 'lost', '2027-01-14', null)).toEqual({ probability: '0', close_date: '2026-11-24' })
  })

  test('brings back the date when Won was chosen by mistake', () => {
    expect(forStage(config, 'proposal', '2026-11-24', '2027-01-14').close_date).toBe('2027-01-14')
  })

  test("a closed deal's probability is fixed", () => {
    expect(config.stages.map(({ key }) => isFixed(config, key))).toEqual([false, false, false, false, true, true])
  })
})

describe('choosing a contact', () => {
  test('fills in the organization if it is blank', () => {
    expect(organizationFor(2, people, null)).toBe(1)
    expect(organizationFor(2, people, 2)).toBe(2)
    expect(organizationFor(1, people, null)).toBeNull()
    expect(organizationFor(null, people, 2)).toBe(2)
  })

  test("shows the organization's contacts first", () => {
    const labels = (groups: ReturnType<typeof contactGroups>) =>
      groups.map(({ value, items }) => [value, items.map(({ label }) => label)])
    expect(labels(contactGroups(people, 1))).toEqual([
      ['At Upland Water', ['Beth', 'Dina']],
      ['Other contacts', ['Adam', 'Carl']],
    ])
    expect(labels(contactGroups(people, null))).toEqual([['', ['Adam', 'Beth', 'Carl', 'Dina']]])
    expect(labels(contactGroups(people, 99))).toEqual([['', ['Adam', 'Beth', 'Carl', 'Dina']]])
    expect(labels(contactGroups([people[1]!], 1))).toEqual([['At Upland Water', ['Beth']]])
  })
})

describe('what is sent', () => {
  const before: DealValues = {
    name: 'Cloud migration',
    organization_id: 1,
    contact_id: 2,
    stage: 'proposal',
    value: '82,000',
    probability: '50',
    close_date: '2027-01-14',
  }

  test('everything for a new deal, as numbers', () => {
    expect(dealBody(undefined, before)).toEqual({ ...before, value: 82000, probability: 50 })
  })

  test('only what changed for an edit', () => {
    expect(dealBody(before, { ...before, value: '$ 90,000', contact_id: null })).toEqual({
      value: 90000,
      contact_id: null,
    })
    expect(dealBody(before, { ...before, value: '82000' })).toEqual({})
    expect(dealBody(before, { ...before, probability: '40%' })).toEqual({ probability: 40 })
  })

  test('the stage, probability and date always go together', () => {
    // The probability and date were set back to what they were by hand.
    expect(dealBody(before, { ...before, stage: 'negotiation' })).toEqual({
      stage: 'negotiation',
      probability: 50,
      close_date: '2027-01-14',
    })
    expect(
      dealBody(before, { ...before, stage: 'won', probability: '100', close_date: '2026-11-20', name: 'Renamed' }),
    ).toEqual({
      name: 'Renamed',
      stage: 'won',
      probability: 100,
      close_date: '2026-11-20',
    })
  })
})

describe('checks', () => {
  test('numbers as people write them', () => {
    expect([wholeNumber('125,000'), wholeNumber('$125000'), wholeNumber(' 0 ')]).toEqual([125000, 125000, 0])
    expect([wholeNumber('12.5'), wholeNumber('ten'), wholeNumber(''), wholeNumber('-1')]).toEqual(
      Array(4).fill(undefined),
    )
  })

  test('value', () => {
    expect([checkValue('0'), checkValue('125,000'), checkValue('999,999,999,999')]).toEqual([true, true, true])
    expect(checkValue(' ')).toBe('Enter a value.')
    expect(checkValue('-1')).toBe('Enter a value of $0 or more.')
    expect(checkValue('12.5')).toBe('Enter a whole number of dollars.')
    expect(checkValue('1,000,000,000,000')).toBe('Enter a value of $999,999,999,999 or less.')
  })

  test('probability', () => {
    expect(['0', '100', '50%'].map(checkProbability)).toEqual([true, true, true])
    expect(['', '101', '-1', '5.5'].map(checkProbability)).toEqual(Array(4).fill('Enter a probability from 0 to 100.'))
  })

  test('close date', () => {
    expect(checkCloseDate(config, 'proposal', '2027-01-14')).toBe(true)
    expect(checkCloseDate(config, 'won', '2026-11-24')).toBe(true)
    expect(checkCloseDate(config, 'won', '2026-11-25')).toBe("A won deal's close date can't be after today.")
    expect(checkCloseDate(config, 'lost', '2026-11-25')).toBe("A lost deal's close date can't be after today.")
    expect(checkCloseDate(config, 'new', '')).toBe('Enter a close date.')
    // Chrome makes 0026 of a year typed as 26.
    for (const stage of ['new', 'won'] as const)
      expect(checkCloseDate(config, stage, '0026-11-11')).toBe('Enter the year with four digits, such as 2026.')
  })
})
