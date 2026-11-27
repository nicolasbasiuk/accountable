import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { followOtherTabs, setMode, storedMode, useMode } from './mode'

const KEY = 'accountable-mode'
const mark = () => document.documentElement.dataset.mode

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.mode
})

afterEach(() => {
  vi.restoreAllMocks()
})

test("light when nothing is stored, or when what's stored isn't dark", () => {
  expect(storedMode()).toBe('light')
  localStorage.setItem(KEY, 'blue')
  expect(storedMode()).toBe('light')
  localStorage.setItem(KEY, 'dark')
  expect(storedMode()).toBe('dark')
})

test('turning dark mode on stores it and marks the page; turning it off stores light and removes the mark', () => {
  setMode('dark')
  expect(localStorage.getItem(KEY)).toBe('dark')
  expect(mark()).toBe('dark')
  setMode('light')
  expect(localStorage.getItem(KEY)).toBe('light')
  expect(mark()).toBeUndefined()
})

test("a change in another tab switches this one and tells what's listening", () => {
  const stop = followOtherTabs()
  const { result } = renderHook(() => useMode())
  expect(result.current).toBe('light')

  // The other tab stores its choice, and this one hears of it.
  act(() => {
    localStorage.setItem(KEY, 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'dark' }))
  })
  expect(mark()).toBe('dark')
  expect(result.current).toBe('dark')

  act(() => {
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
  })
  expect(mark()).toBeUndefined()
  expect(result.current).toBe('light')
  stop()
})

test('when the browser refuses storage, it stays light and nothing throws', () => {
  const refuse = () => {
    throw new DOMException('Refused', 'SecurityError')
  }
  const reading = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
  const writing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
  expect(storedMode()).toBe('light')
  expect(() => setMode('dark')).not.toThrow()
  expect(reading).toHaveBeenCalled()
  expect(writing).toHaveBeenCalled()
  // Not kept, but shown until the page closes.
  expect(mark()).toBe('dark')
})
