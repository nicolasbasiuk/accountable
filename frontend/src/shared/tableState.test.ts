import { expect, test } from 'vitest'
import { fromAddress, toAddress, type TableRules } from './tableState'

const rules: TableRules = {
  columns: ['name', 'value', 'close'],
  filters: ['lead', 'customer'],
  sort: 'close',
  descending: true,
}
const read = (address: string) => fromAddress(new URLSearchParams(address), rules)
const write = (state: ReturnType<typeof read>) => toAddress(state, rules).toString()

test('a plain address is the usual state', () => {
  expect(read('')).toEqual({ search: '', sort: 'close', descending: true, filter: '' })
  expect(write(read(''))).toBe('')
})

test.each([
  'search=cloud',
  'search=caf%C3%A9+%26+bar',
  'sort=name',
  'sort=-value',
  'sort=close',
  'filter=lead',
  'search=a&filter=customer&sort=-name',
])('%s is the same after reading and writing', (address) => {
  expect(write(read(address))).toBe(address)
})

test('search, sort and filter are read', () => {
  expect(read('search=a&filter=customer&sort=-name')).toEqual({
    search: 'a',
    sort: 'name',
    descending: true,
    filter: 'customer',
  })
  expect(read('sort=value')).toMatchObject({ sort: 'value', descending: false })
})

test('the usual sort the other way round is kept', () => {
  expect(write({ search: '', sort: 'close', descending: false, filter: '' })).toBe('sort=close')
})

test('what it does not know counts as not there', () => {
  expect(read('sort=-nothing&filter=nobody&other=1')).toEqual(read(''))
})
