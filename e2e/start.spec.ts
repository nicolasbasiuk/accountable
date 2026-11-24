import path from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { ROOT, startBackend, startFrontend, stop, waitFor } from '../scripts/lib.mjs'
import { API_PORT, api, CONSOLE, DATABASE, dialog, expect, open, panel, rows, test, TODAY } from './support'

const SECTIONS = ['Dashboard', 'Organizations', 'Contacts', 'Deals', 'Pipeline']

test('opens on the dashboard, and all five sections have sample data', async ({ page }) => {
  await open(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard')
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(SECTIONS)
  await expect(panel(page, 'Follow-ups').getByRole('listitem')).toHaveCount(16)
  for (const [name, amount] of [['Organizations', '24 organizations'], ['Contacts', '60 contacts'], ['Deals', '96 deals']] as const) {
    await page.getByRole('navigation').getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page.getByRole('status')).toHaveText(amount)
    await expect(page).toHaveTitle(`${name} - Accountable`)
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Pipeline' }).click()
  await expect(page.locator('header')).toContainText('44 open deals')
})

test("each section's and record's address works after a refresh, in a new tab and with Back", async ({ page, context }) => {
  const addresses = [
    ['/', 'Dashboard'],
    ['/organizations', 'Organizations'],
    ['/organizations/1', 'Upland Water'],
    ['/contacts', 'Contacts'],
    ['/contacts/1', 'Marcus Webb'],
    ['/deals', 'Deals'],
    ['/deals/1', (await api<{ name: string }>(page, '/deals/1')).name],
    ['/pipeline', 'Pipeline'],
  ] as const
  const heading = page.getByRole('heading', { level: 1 })
  for (const [address, title] of addresses) {
    await open(page, address)
    await expect(heading).toHaveText(title)
    await page.reload()
    await expect(heading).toHaveText(title)
    const tab = await context.newPage()
    await tab.goto(address)
    await expect(tab.getByRole('heading', { level: 1 })).toHaveText(title)
    await tab.close()
  }
  for (const [address, title] of [...addresses].reverse().slice(1)) {
    await page.goBack()
    await expect(page).toHaveURL(address)
    await expect(heading).toHaveText(title)
  }
})

test('opening a record in a new tab', async ({ page, context }) => {
  await open(page, '/contacts')
  const opened = context.waitForEvent('page')
  await page.getByRole('link', { name: 'Marcus Webb' }).click({ modifiers: ['ControlOrMeta'] })
  await expect((await opened).getByRole('heading', { level: 1 })).toHaveText('Marcus Webb')
  await expect(page).toHaveURL('/contacts')
})

test('an unknown address gets its page', async ({ page }) => {
  await open(page, '/nowhere/at/all')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("There's no page at this address")
  await page.getByRole('main').getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard')
})

test('a record that no longer exists gets its page', async ({ page, problems }) => {
  problems.expect(CONSOLE.notFound)
  for (const [address, text, list] of [
    ['/organizations/999', 'This organization no longer exists', 'Organizations'],
    ['/contacts/999', 'This contact no longer exists', 'Contacts'],
    ['/deals/999', 'This deal no longer exists', 'Deals'],
    ['/deals/not-a-number', 'This deal no longer exists', 'Deals'],
  ] as const) {
    await open(page, address)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(text)
    await page.getByRole('link', { name: `Go to ${list}` }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(list)
  }
})

test('a record deleted in another tab gets its page', async ({ page, problems }) => {
  problems.expect(CONSOLE.notFound)
  await open(page, '/deals/1')
  await expect(panel(page, 'Details')).toBeVisible()
  await page.request.delete(`http://127.0.0.1:${API_PORT}/api/deals/1`)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This deal no longer exists')
})

test('without the internet, pages still load and save', async ({ page }) => {
  await open(page, '/')
  // Playwright's setOffline would block this computer's own server too.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false })
    window.dispatchEvent(new Event('offline'))
  })
  await page.getByRole('navigation').getByRole('link', { name: 'Contacts' }).click()
  await expect(page.getByRole('status')).toHaveText('60 contacts')
  await page.getByRole('button', { name: 'Add contact' }).click()
  await dialog(page).getByLabel('Name').fill('Zoe Marsh')
  await dialog(page).getByRole('button', { name: 'Add contact' }).click()
  await expect(page.getByRole('status')).toHaveText('61 contacts')
})

test.describe('when the server stops', () => {
  const ports = { web: 5274, api: 8101 }
  const env = {
    ...process.env,
    ACCOUNTABLE_DB: path.join(path.dirname(DATABASE), 'stops', 'accountable.db'),
    ACCOUNTABLE_TODAY: TODAY,
    ACCOUNTABLE_WEB_PORT: String(ports.web),
    ACCOUNTABLE_API_PORT: String(ports.api),
    ACCOUNTABLE_VITE_CACHE: path.join(ROOT, 'node_modules', '.vite-tests-stops'),
  }
  let backend: ChildProcess
  let frontend: ChildProcess

  async function runBackend() {
    backend = startBackend(ports.api, { env }) as ChildProcess
    expect(await waitFor(`http://127.0.0.1:${ports.api}/api/health`, backend)).toBe(true)
  }

  test.beforeAll(async () => {
    await runBackend()
    frontend = startFrontend({ env }) as ChildProcess
    expect(await waitFor(`http://127.0.0.1:${ports.web}/`, frontend)).toBe(true)
  })
  test.afterAll(async () => {
    await stop(frontend)
    await stop(backend)
  })

  test('the screen says so, and Try again works once it is back', async ({ page, problems }) => {
    problems.expect(CONSOLE.unreachable)
    const site = `http://localhost:${ports.web}`
    await open(page, `${site}/organizations`)
    await expect(rows(page)).toHaveCount(24)

    await stop(backend)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByRole('alert')).toContainText("The server can't be reached. What you see may be out of date.")
    await expect(rows(page)).toHaveCount(24)

    // A page that hasn't loaded anything yet.
    await page.getByRole('navigation').getByRole('link', { name: 'Contacts' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText("The server can't be reached.")
    await page.getByRole('main').getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText("The server can't be reached.")

    await runBackend()
    await page.getByRole('main').getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('status')).toHaveText('60 contacts')
    await expect(page.getByRole('alert')).toHaveCount(0)

    // From the very start.
    await stop(backend)
    await page.goto(`${site}/deals`)
    await expect(page.getByRole('alert')).toContainText("The server can't be reached.")
    await runBackend()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('status')).toHaveText('96 deals')
  })

  test('a save that cannot reach it keeps what was entered', async ({ page, problems }) => {
    problems.expect(CONSOLE.unreachable)
    await open(page, `http://localhost:${ports.web}/contacts/1`)
    await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
    await dialog(page).getByLabel('Name').fill('Marcus Webster')
    await stop(backend)
    await dialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog(page).getByRole('alert')).toHaveText("Not saved. The server can't be reached.")
    await runBackend()
    await dialog(page).getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marcus Webster')
  })
})
