import { expect, test as base, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from '../scripts/lib.mjs'

export const WEB_PORT = 5273
export const API_PORT = 8100
export const TODAY = '2026-11-24'

/** The tests' own database. Refuses any other, which could be the user's data (R7). */
function ownDatabase() {
  const file = path.resolve(process.env.ACCOUNTABLE_DB || 'unset')
  const folder = path.dirname(file)
  const inTemp = [path.resolve(os.tmpdir()), realpathSync(os.tmpdir())].includes(path.dirname(folder))
  if (!inTemp || !path.basename(folder).startsWith('accountable-tests-')) {
    throw new Error('The tests need a database of their own. Run them with: npm test')
  }
  return file
}

export const DATABASE = ownDatabase()

/** The settings the app runs with in the tests. */
export const APP_ENV = {
  ACCOUNTABLE_DB: DATABASE,
  ACCOUNTABLE_TODAY: TODAY,
  ACCOUNTABLE_WEB_PORT: String(WEB_PORT),
  ACCOUNTABLE_API_PORT: String(API_PORT),
}

/** The real reset command, which is also how each test gets fresh sample data. */
export function seed(...args: string[]) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'seed.mjs'), ...args], {
    env: { ...process.env, ...APP_ENV },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** The console errors Chrome writes itself when a request fails (Q5). A test that causes one names it. */
export const CONSOLE = {
  notFound: /status of 404/,
  conflict: /status of 409/,
  failedSave: /status of 500|net::ERR_FAILED/,
  unreachable: /status of 50[02]|net::ERR_FAILED|net::ERR_CONNECTION_REFUSED/, // 500 or 502, by Vite's version.
}

type Problems = { expect: (pattern: RegExp) => void }

export const test = base.extend<{ freshData: void; problems: Problems }>({
  freshData: [
    async ({}, use) => {
      const { status, stdout, stderr } = seed('--yes')
      expect(status, stdout + stderr).toBe(0)
      await use()
    },
    { auto: true },
  ],

  // Fails a test on a console error, or a request outside the computer (Q5, R2).
  problems: [
    async ({ context }, use) => {
      const found: string[] = []
      const expected: RegExp[] = []
      context.on('console', (message) => {
        if (message.type() === 'error') found.push(`${message.text()} (${message.location().url})`)
      })
      context.on('weberror', (error) => found.push(`Not caught: ${error.error().message}`))
      context.on('request', (request) => {
        const { protocol, hostname } = new URL(request.url())
        if (protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(hostname)) found.push(`Outside: ${request.url()}`)
      })
      await use({ expect: (pattern) => void expected.push(pattern) })
      expect(found.filter((problem) => !expected.some((pattern) => pattern.test(problem)))).toEqual([])
      for (const pattern of expected) expect(found, 'an error named by the test').toContainEqual(expect.stringMatching(pattern))
    },
    { auto: true },
  ],
})

export { expect }

// What the specs share

/** The server's own answer, to compare with what a screen shows. */
export async function api<T>(page: Page, address: string): Promise<T> {
  const answer = await page.request.get(`http://127.0.0.1:${API_PORT}/api${address}`)
  expect(answer.ok(), `GET ${address}`).toBe(true)
  return (await answer.json()) as T
}

/** Opens a page and waits until it has loaded. */
export async function open(page: Page, address: string) {
  await page.goto(address)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

/** The rows of a table, without its heading. */
export const rows = (page: Page) => page.locator('tbody tr')

/** The texts in a column, from the top. */
export async function column(page: Page, heading: string): Promise<string[]> {
  await expect(rows(page).first()).toBeVisible()
  const headings = await page.locator('thead th').allInnerTexts()
  const index = headings.findIndex((text) => text.trim().startsWith(heading))
  expect(index, `a column called ${heading}`).toBeGreaterThanOrEqual(0)
  return (await page.locator(`tbody tr td:nth-child(${index + 1})`).allInnerTexts()).map((text) => text.trim())
}

export const search = (page: Page) => page.getByRole('searchbox')
/** A form. Messages are dialogs too, for screen readers. */
export const dialog = (page: Page) => page.getByRole('dialog').filter({ has: page.locator('form') })
export const question = (page: Page) => page.getByRole('alertdialog')

/** Chooses a record in a picker by typing part of its name. */
export async function pick(within: Locator, page: Page, label: string, name: string) {
  const input = within.getByRole('combobox', { name: label })
  await input.fill(name)
  await page.getByRole('option', { name }).first().click()
  await expect(input).toHaveValue(name)
}

/** Chooses a stage in the deal form. */
export async function pickStage(within: Locator, page: Page, name: string) {
  await within.getByRole('combobox', { name: 'Stage' }).click()
  await page.getByRole('option', { name, exact: true }).click()
  await expect(within.getByRole('combobox', { name: 'Stage' })).toContainText(name)
}

/** Where the app keeps the chosen mode (G10), as in `frontend/src/mode.ts`. */
export const MODE_KEY = 'accountable-mode'

/** Starts the page in dark mode, as if it had been chosen before. A choice made later in the test is kept. */
export async function inDarkMode(page: Page) {
  await page.addInitScript((key) => {
    if (location.protocol.startsWith('http') && localStorage.getItem(key) === null) localStorage.setItem(key, 'dark')
  }, MODE_KEY)
}

/** The mode the page shows. */
export const shownMode = (page: Page) => page.evaluate(() => document.documentElement.dataset.mode ?? 'light')

export const modeSwitch = (page: Page) => page.getByRole('switch', { name: 'Dark mode' })

/** The panel with a heading, such as "Deals" on an organization's page. */
export const panel = (page: Page, heading: string) => page.getByRole('region', { name: heading, exact: true })
