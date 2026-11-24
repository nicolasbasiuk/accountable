import { afterEach, describe, expect, test } from 'vitest'
import { date, dateTime, dayOf, daysBetween, due, fromField, money, monthAndYear, monthName, percent, plural, share, shorten, shortMoney, time, toField } from './format'

test('money is whole dollars, rounded only when shown', () => {
  expect(money(125000)).toBe('$125,000')
  expect(money(0)).toBe('$0')
  expect(money(2650.49)).toBe('$2,650')
  expect(money(2650.5)).toBe('$2,651')
  expect(money(999_999_999_999)).toBe('$999,999,999,999')
})

test('short money for the axis of a chart', () => {
  expect([0, 500, 50_000, 200_000, 1_500_000].map(shortMoney)).toEqual(['$0', '$500', '$50K', '$200K', '$1.5M'])
})

test('percentages', () => {
  expect(percent(75)).toBe('75%')
  expect(share(0.8024)).toBe('80%')
  expect(share(1)).toBe('100%')
})

test('a shortened text', () => {
  expect(shorten('First call')).toBe('First call')
  expect(shorten('First line\nSecond line')).toBe('First line')
  expect(shorten('one two three four', 8)).toBe('one two...')
})

test('plurals', () => {
  expect([plural(0, 'deal'), plural(1, 'deal'), plural(2, 'deal')]).toEqual(['0 deals', '1 deal', '2 deals'])
})

const originalZone = process.env.TZ

describe.each(['America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'])('in %s', (zone) => {
  // Node reads the time zone again each time it's set.
  const inZone = <T>(work: () => T): T => {
    process.env.TZ = zone
    return work()
  }
  afterEach(() => {
    process.env.TZ = originalZone
  })

  test('a date is the same day everywhere', () => {
    inZone(() => {
      expect(date('2026-11-24')).toBe('Nov 24, 2026')
      expect(date('2026-01-01')).toBe('Jan 1, 2026')
      expect(date('2028-02-29')).toBe('Feb 29, 2028')
      expect(monthName('2026-11-01')).toBe('Nov')
      expect(monthAndYear('2025-12-01')).toBe('Dec 2025')
    })
  })

  test('days between, also across a change of the clocks', () => {
    inZone(() => {
      expect(daysBetween('2026-11-24', '2026-11-24')).toBe(0)
      expect(daysBetween('2026-10-20', '2026-11-03')).toBe(14)
      expect(daysBetween('2026-11-24', '2026-11-16')).toBe(-8)
      expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
      expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    })
  })

  test('when something is due', () => {
    inZone(() => {
      expect(due('2026-11-24', '2026-11-24')).toBe('Today')
      expect(due('2026-11-25', '2026-11-24')).toBe('Tomorrow')
      expect(due('2026-11-26', '2026-11-24')).toBe('Nov 26, 2026')
    })
  })

  test('a moment is shown in local time', () => {
    const shown = {
      'America/Los_Angeles': ['Nov 24, 2026, 3:30 PM', '2026-11-24', '2026-11-24T15:30'],
      'Europe/London': ['Nov 24, 2026, 11:30 PM', '2026-11-24', '2026-11-24T23:30'],
      'Asia/Tokyo': ['Nov 25, 2026, 8:30 AM', '2026-11-25', '2026-11-25T08:30'],
    }[zone]!
    inZone(() => {
      const moment = '2026-11-24T23:30:00Z'
      expect([dateTime(moment), dayOf(moment), toField(moment)]).toEqual(shown)
      expect(dateTime(moment)).toContain(time(moment))
      expect(fromField(toField(moment))).toBe(moment)
    })
  })
})
