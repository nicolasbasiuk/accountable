import { MutationObserver, onlineManager, QueryObserver, type QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { messages } from './messageStore'
import * as messageStore from './messageStore'
import { CARD_MOVE, createQueryClient, refetchOnFocus } from './queryClient'

let client: QueryClient
let reads: string[]
const leave: (() => void)[] = []

/** A part of the screen that shows something from the server. */
async function watch(name: string) {
  const observer = new QueryObserver(client, { queryKey: [name], queryFn: async () => reads.push(name) })
  leave.push(observer.subscribe(() => {}))
  await vi.waitFor(() => expect(reads).toContain(name))
}

function change(work: () => Promise<unknown>, mutationKey?: string[]) {
  return new MutationObserver(client, { mutationFn: work, mutationKey }).mutate().catch(() => {})
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(async () => {
  client = createQueryClient()
  reads = []
  await watch('board')
  await watch('dashboard')
  reads = []
})

afterEach(() => {
  leave.splice(0).forEach((stop) => stop())
  onlineManager.setOnline(true)
  vi.restoreAllMocks()
})

test('a change that succeeds refreshes everything on screen', async () => {
  await change(async () => 'saved')
  expect(reads.sort()).toEqual(['board', 'dashboard'])
})

test('a change that fails refreshes nothing', async () => {
  await change(async () => Promise.reject(new Error('no')))
  await settled()
  expect(reads).toEqual([])
})

test('card moves refresh only after the last one is saved', async () => {
  const finish: (() => void)[] = []
  const move = () => change(() => new Promise<void>((resolve) => finish.push(resolve)), CARD_MOVE)
  const first = move()
  const second = move()
  await vi.waitFor(() => expect(finish).toHaveLength(2))

  finish[0]!()
  await first
  await settled()
  expect(reads).toEqual([])

  finish[1]!()
  await second
  expect(reads.sort()).toEqual(['board', 'dashboard'])
})

test('the last card move refreshes also if it fails, because earlier ones were saved', async () => {
  let fail = () => {}
  let finish = () => {}
  const first = change(() => new Promise<void>((resolve) => (finish = resolve)), CARD_MOVE)
  const second = change(() => new Promise<void>((_, reject) => (fail = () => reject(new Error('no')))), CARD_MOVE)
  await vi.waitFor(() => (finish(), fail()))
  finish()
  await first
  fail()
  await second
  await vi.waitFor(() => expect(reads.sort()).toEqual(['board', 'dashboard']))
})

test('another change while a card is being moved', async () => {
  let finish = () => {}
  const move = change(() => new Promise<void>((resolve) => (finish = resolve)), CARD_MOVE)
  await change(async () => 'saved')
  finish()
  await move
  expect(reads).toContain('board')
})

test('a saved change closes the Undo of an earlier move, and a failed one does not', async () => {
  const close = vi.spyOn(messages, 'close')
  messageStore.showMove('Moved to Won', () => {})
  await change(async () => Promise.reject(new Error('no')))
  expect(close).not.toHaveBeenCalled()
  await change(async () => 'saved')
  expect(close).toHaveBeenCalledOnce()
})

test('loads and saves without the internet', async () => {
  onlineManager.setOnline(false)
  await watch('offline')
  let saved = false
  await change(async () => (saved = true))
  expect(saved).toBe(true)
  expect(reads).toContain('offline')
})

test('refetches when the window gets the focus, and when the tab is shown', async () => {
  client.mount()
  refetchOnFocus()
  for (const [target, event] of [[window, 'focus'], [document, 'visibilitychange']] as const) {
    reads = []
    target.dispatchEvent(new Event(event))
    await vi.waitFor(() => expect(reads.sort()).toEqual(['board', 'dashboard']))
  }
  client.unmount()
})
