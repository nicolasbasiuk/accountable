import type { Locator, Page } from '@playwright/test'
import { API_PORT, api, CONSOLE, dialog, expect, open, panel, rows, search, test } from './support'

type Card = { id: number; name: string; organization: string | null; value: number; probability: number; close_date: string; days_late: number }
type Board = { count: number; value: number; expected: number; columns: { stage: string; count: number; value: number; expected: number; cards: Card[] }[] }
type Deal = { id: number; stage: string; probability: number; close_date: string; contact: { id: number; name: string } | null }

const NAMES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

const board = (page: Page) => api<Board>(page, '/board')
const savedIds = async (page: Page, stage: string) => (await board(page)).columns.find((one) => one.stage === stage.toLowerCase())!.cards.map(({ id }) => id)
const savedCards = async (page: Page, stage: string) => (await board(page)).columns.find((one) => one.stage === stage.toLowerCase())!.cards

const column = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const cards = (page: Page, name: string) => column(page, name).getByRole('article')
const cardLink = (page: Page, id: number) => page.locator(`a[href="/deals/${id}"]`)
const card = (page: Page, id: number) => page.getByRole('article').filter({ has: cardLink(page, id) })
const head = (page: Page, name: string) => column(page, name).getByRole('heading').locator('xpath=../..')

/** The ids of the cards in a column, as shown. */
const shownIds = async (page: Page, name: string) =>
  (await cards(page, name).getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')!))).map((href) => Number(href.split('/').pop()))

const dollars = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`

async function openBoard(page: Page) {
  await open(page, '/pipeline')
  await expect(cards(page, 'New').first()).toBeVisible()
}

async function middle(target: Locator) {
  const box = (await target.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

/** Picks a card up with the mouse. */
async function lift(page: Page, id: number) {
  const { x, y } = await middle(card(page, id))
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 8, y + 2, { steps: 4 })
  await expect(card(page, id)).toHaveCSS('position', 'fixed')
}

/** Moves the held card over a place, and lets go. */
async function dropOver(page: Page, id: number, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 12 })
  await page.mouse.move(x, y + 1)
  await page.mouse.up()
  await expect(card(page, id)).not.toHaveCSS('position', 'fixed')
}

/** Drags a card above another one. Coming from above in the same column, it has to stop before the other one's edge. */
async function dragAbove(page: Page, id: number, target: number, fromAbove = false) {
  await lift(page, id)
  const { x, box } = await middle(card(page, target))
  await dropOver(page, id, x, box.y + (fromAbove ? -14 : 4))
}

/** Drags a card below the last one in a column. */
async function dragToEnd(page: Page, id: number, name: string) {
  await lift(page, id)
  const { x, box } = await middle(cards(page, name).last())
  await dropOver(page, id, x, box.y + box.height + 40)
}

const saved = (page: Page) => page.waitForResponse((answer) => answer.url().endsWith('/move'))
/** A short message. One about a problem is announced at once, so it has another role. */
const message = (page: Page, text: string | RegExp) => page.locator('[role=dialog], [role=alertdialog]').filter({ hasText: text })

test('six columns fit at 1280, each scrolling on its own', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openBoard(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(720)
  for (const name of NAMES) {
    const { box } = await middle(column(page, name))
    expect(box.x + box.width).toBeLessThanOrEqual(1280)
    expect(box.y + box.height).toBeLessThanOrEqual(720)
    const { count, value, expected } = (await board(page)).columns[NAMES.indexOf(name)]!
    await expect(head(page, name)).toContainText(`${name}${count}${dollars(value)}${dollars(expected)} expected`)
    if (['Won', 'Lost'].includes(name)) await expect(head(page, name)).toContainText('Last 90 days')
    else await expect(head(page, name)).not.toContainText('Last 90 days')
  }
  const scrolled = (name: string) => column(page, name).locator('[data-rfd-droppable-id]').evaluate((list) => list.scrollTop)
  await column(page, 'New').locator('[data-rfd-droppable-id]').evaluate((list) => list.scrollBy(0, 300))
  expect(await scrolled('New')).toBe(300)
  expect(await scrolled('Qualified')).toBe(0)
})

test('narrower than 1280, the page scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 })
  await openBoard(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280)
})

test('dragging to another column changes the stage, probability and figures at once', async ({ page }) => {
  await openBoard(page)
  const before = await board(page)
  const [moved] = before.columns[0]!.cards
  const [target] = before.columns[2]!.cards
  // The server is held up, so whatever shows isn't its answer.
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/move', async (route) => {
    await held
    await route.continue()
  })
  await dragAbove(page, moved!.id, target!.id)

  expect((await shownIds(page, 'Proposal')).slice(0, 2)).toEqual([moved!.id, target!.id])
  await expect(card(page, moved!.id)).toContainText('50%')
  const expected = before.expected + moved!.value * 0.4
  const check = async () => {
    await expect(page.locator('header')).toContainText(`44 open deals${dollars(before.value)} open value${dollars(expected)} expected`)
    await expect(head(page, 'New')).toContainText(`New15${dollars(before.columns[0]!.value - moved!.value)}`)
    await expect(head(page, 'Proposal')).toContainText(`Proposal10${dollars(before.columns[2]!.value + moved!.value)}`)
  }
  await check()
  const answered = saved(page)
  release()
  await answered
  await expect(message(page, `Moved ${moved!.name} to Proposal.`)).toBeVisible()
  await check()

  await page.reload()
  await expect(cards(page, 'Proposal').first()).toBeVisible()
  expect((await shownIds(page, 'Proposal')).slice(0, 2)).toEqual([moved!.id, target!.id])
  await check()

  await page.getByRole('navigation').getByRole('link', { name: 'Deals' }).click()
  await search(page).fill(moved!.organization!)
  const row = rows(page).filter({ has: page.locator(`a[href="/deals/${moved!.id}"]`) })
  await expect(row).toContainText('Proposal')
  await expect(row).toContainText('50%')
})

test('dragging within a column, to the top, middle and end', async ({ page }) => {
  await openBoard(page)
  const [a, b, c, d, e] = await savedIds(page, 'Lost')
  const after = async (...order: (number | undefined)[]) => {
    expect(await shownIds(page, 'Lost')).toEqual(order)
    await expect.poll(() => savedIds(page, 'Lost')).toEqual(order)
  }
  let answered = saved(page)
  await dragAbove(page, d!, a!)
  await answered
  await after(d, a, b, c, e)
  answered = saved(page)
  await dragAbove(page, d!, c!, true)
  await answered
  await after(a, b, d, c, e)
  answered = saved(page)
  await dragToEnd(page, a!, 'Lost')
  await answered
  await after(b, d, c, e, a)

  await page.reload()
  await expect(cards(page, 'Lost').first()).toBeVisible()
  await after(b, d, c, e, a)
  // A place change inside a column is no change of stage.
  await expect(message(page, 'Moved')).toHaveCount(0)
})

test('moving with the keyboard', async ({ page }) => {
  await openBoard(page)
  const [first, second] = await savedIds(page, 'Qualified')
  await cardLink(page, first!).focus()
  await page.keyboard.press('Space')
  await expect(card(page, first!)).toHaveCSS('position', 'fixed')
  await page.keyboard.press('ArrowDown')
  let answered = saved(page)
  await page.keyboard.press('Space')
  await answered
  await expect.poll(async () => (await savedIds(page, 'Qualified')).slice(0, 2)).toEqual([second, first])

  await expect(cardLink(page, first!)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(card(page, first!)).toHaveCSS('position', 'fixed')
  await page.keyboard.press('ArrowRight')
  answered = saved(page)
  await page.keyboard.press('Space')
  await answered
  await expect.poll(() => savedIds(page, 'Proposal')).toContain(first)
  expect(await api<Deal>(page, `/deals/${first}`)).toMatchObject({ stage: 'proposal', probability: 50 })

  // Escape puts it back.
  const order = await shownIds(page, 'Proposal')
  await cardLink(page, order[0]!).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await expect(card(page, order[0]!)).not.toHaveCSS('position', 'fixed')
  expect(await shownIds(page, 'Proposal')).toEqual(order)
})

test('Won and Lost set the date to today, winning makes a customer, and reopening keeps the date', async ({ page }) => {
  const deals = await api<Deal[]>(page, '/deals')
  const contacts = await api<{ id: number; status: string }[]>(page, '/contacts')
  const status = (id: number) => contacts.find((contact) => contact.id === id)?.status
  const deal = deals.find(({ stage, contact }) => stage === 'negotiation' && contact && status(contact.id) !== 'customer') ?? deals.find(({ stage, contact }) => stage === 'qualified' && contact && status(contact.id) !== 'customer')!
  await openBoard(page)
  await card(page, deal.id).scrollIntoViewIfNeeded()

  let answered = saved(page)
  await dragAbove(page, deal.id, (await savedIds(page, 'Won'))[0]!)
  await answered
  await expect(card(page, deal.id)).toContainText('100%')
  await expect(card(page, deal.id)).toContainText('Nov 24, 2026')
  await expect.poll(async () => (await api<Deal>(page, `/deals/${deal.id}`)).close_date).toBe('2026-11-24')
  await open(page, `/contacts/${deal.contact!.id}`)
  await expect(panel(page, 'Details')).toContainText('Customer')
  await expect(panel(page, 'Timeline').getByRole('listitem').first()).toContainText(/Moved from \w+ to Won/)

  // Lost, from Won.
  await openBoard(page)
  answered = saved(page)
  await dragAbove(page, deal.id, (await savedIds(page, 'Lost'))[0]!)
  await answered
  await expect(card(page, deal.id)).toContainText('0%')
  await expect(card(page, deal.id)).toContainText('Nov 24, 2026')

  // An older one reopened keeps its date, so it's late.
  const older = (await savedCards(page, 'Lost'))[1]!
  answered = saved(page)
  await dragAbove(page, older.id, (await savedIds(page, 'Proposal'))[0]!)
  await answered
  await expect(card(page, older.id)).toContainText('Late')
  expect(await api<Deal>(page, `/deals/${older.id}`)).toMatchObject({ stage: 'proposal', probability: 50, close_date: older.close_date })
  await open(page, `/contacts/${deal.contact!.id}`)
  await expect(panel(page, 'Details')).toContainText('Customer')
})

test('Undo after Won puts everything back', async ({ page }) => {
  const contacts = await api<{ id: number; status: string }[]>(page, '/contacts')
  const deals = await api<Deal[]>(page, '/deals')
  const visible = (await savedIds(page, 'Qualified')).slice(0, 5)
  const deal = deals.find(({ id, contact }) => visible.includes(id) && contact && contacts.find((one) => one.id === contact.id)!.status !== 'customer')!
  const statusBefore = contacts.find(({ id }) => id === deal.contact!.id)!.status
  await openBoard(page)
  const [boardBefore, timelineBefore, orderBefore] = [await board(page), await api<unknown[]>(page, `/deals/${deal.id}/timeline`), await shownIds(page, 'Qualified')]

  const answered = saved(page)
  await dragAbove(page, deal.id, (await savedIds(page, 'Won'))[1]!)
  await answered
  await expect(message(page, 'to Won.')).toBeVisible()
  expect((await api<{ status: string }>(page, `/contacts/${deal.contact!.id}`)).status).toBe('customer')

  await message(page, 'to Won.').getByRole('button', { name: 'Undo' }).click()
  await expect(message(page, 'to Won.')).toHaveCount(0)
  await expect.poll(() => shownIds(page, 'Qualified')).toEqual(orderBefore)
  expect(await board(page)).toEqual(boardBefore)
  expect(await api<unknown[]>(page, `/deals/${deal.id}/timeline`)).toEqual(timelineBefore)
  expect((await api<{ status: string }>(page, `/contacts/${deal.contact!.id}`)).status).toBe(statusBefore)
  expect(await api<Deal>(page, `/deals/${deal.id}`)).toEqual(deal)
})

test('the Undo message goes after 10 seconds, and stays while pointed at or focused', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-24T12:00:00') })
  await openBoard(page)
  const [first, second] = await savedIds(page, 'New')
  const move = async (id: number) => {
    const answered = saved(page)
    await dragAbove(page, id, (await savedIds(page, 'Qualified'))[0]!)
    await answered
    await expect(message(page, 'to Qualified.')).toBeVisible()
  }
  await move(first!)
  await page.mouse.move(5, 5)
  await page.clock.fastForward(8_500)
  await expect(message(page, 'to Qualified.')).toBeVisible()
  await page.clock.fastForward(2_000)
  await expect(message(page, 'to Qualified.')).toHaveCount(0)

  await move(second!)
  await message(page, 'to Qualified.').hover()
  await page.clock.fastForward(30_000)
  await expect(message(page, 'to Qualified.')).toBeVisible()
  await message(page, 'to Qualified.').getByRole('button', { name: 'Undo' }).focus()
  await page.mouse.move(5, 5)
  await page.clock.fastForward(30_000)
  await expect(message(page, 'to Qualified.')).toBeVisible()
})

test('the Undo message goes when anything else is changed', async ({ page }) => {
  await openBoard(page)
  const [first, second] = await savedIds(page, 'New')
  const [target] = await savedIds(page, 'Qualified')
  let answered = saved(page)
  await dragAbove(page, first!, target!)
  await answered
  await expect(message(page, 'to Qualified.')).toHaveCount(1)

  // Another move, even inside a column.
  answered = saved(page)
  await dragAbove(page, target!, first!)
  await answered
  await expect(message(page, 'to Qualified.')).toHaveCount(0)

  answered = saved(page)
  await dragAbove(page, second!, (await savedIds(page, 'Proposal'))[0]!)
  await answered
  await expect(message(page, 'to Proposal.')).toBeVisible()
  await column(page, 'New').getByRole('button', { name: 'Add deal in New' }).click()
  await dialog(page).getByLabel('Name').fill('Zebra system')
  await dialog(page).getByLabel('Value').fill('1000')
  await dialog(page).getByLabel('Close date').fill('2027-02-01')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(message(page, 'Added Zebra system.')).toBeVisible()
  await expect(message(page, 'to Proposal.')).toHaveCount(0)
})

test('when the server is slow, the card stays where it was dropped', async ({ page }) => {
  await openBoard(page)
  const [first] = await savedIds(page, 'New')
  const [target] = await savedIds(page, 'Qualified')
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/move', async (route) => {
    await held
    await route.continue()
  })
  await dragAbove(page, first!, target!)
  // The board is loaded again meanwhile, without the move.
  const loaded = page.waitForResponse('**/api/board')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await loaded
  expect((await shownIds(page, 'Qualified'))[0]).toBe(first)
  expect(await savedIds(page, 'New')).toContain(first)
  const answered = saved(page)
  release()
  await answered
  await expect(message(page, 'to Qualified.')).toBeVisible()
  expect((await shownIds(page, 'Qualified'))[0]).toBe(first)
})

test('a dropped card never shows where it came from, not even for a frame', async ({ page }) => {
  await openBoard(page)
  const [first] = await savedIds(page, 'New')
  const [target] = await savedIds(page, 'Qualified')
  await lift(page, first!)
  const { x, box } = await middle(card(page, target!))
  await page.mouse.move(x, box.y + 4, { steps: 12 })
  // Where the card is on each frame, once it's no longer held.
  await page.evaluate((href) => {
    const seen: string[] = []
    Object.assign(window, { seen })
    const look = () => {
      const article = document.querySelector(`a[href="${href}"]`)?.closest('article')
      const held = article && getComputedStyle(article).position === 'fixed'
      if (!held) seen.push(article?.closest('section')?.getAttribute('aria-label') ?? 'nowhere')
      requestAnimationFrame(look)
    }
    look()
  }, `/deals/${first}`)
  const answered = saved(page)
  await page.mouse.up()
  await answered
  await expect(message(page, 'to Qualified.')).toBeVisible()
  // Long enough to include the board being loaded again.
  await expect.poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen.length)).toBeGreaterThan(30)
  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen)
  expect([...new Set(seen)]).toEqual(['Qualified'])
})

test('when the save fails, the card goes back with a message', async ({ page, problems }) => {
  problems.expect(CONSOLE.failedSave)
  await openBoard(page)
  const before = await board(page)
  const [first] = await savedIds(page, 'New')
  const order = await shownIds(page, 'New')
  await page.route('**/move', (route) => route.fulfill({ status: 500, json: { message: 'Something went wrong on the server.', fields: {} } }))
  await dragAbove(page, first!, (await savedIds(page, 'Qualified'))[0]!)
  await expect(message(page, 'Not moved. Something went wrong on the server.')).toBeVisible()
  await expect.poll(() => shownIds(page, 'New')).toEqual(order)
  await expect(head(page, 'New')).toContainText(dollars(before.columns[0]!.value))
  expect(await board(page)).toEqual(before)
})

test('one of several moves fails, and the others are kept', async ({ page, problems }) => {
  problems.expect(CONSOLE.failedSave)
  await openBoard(page)
  const [a, b, c] = await savedIds(page, 'New')
  const target = (await savedIds(page, 'Qualified'))[0]!
  await page.route(`**/api/deals/${b}/move`, (route) => route.fulfill({ status: 500, json: { message: 'No.', fields: {} } }))
  for (const id of [a, b, c]) await dragAbove(page, id!, target)
  await expect(message(page, 'Not moved. No.')).toBeVisible()
  await expect.poll(async () => (await savedIds(page, 'Qualified')).slice(0, 3)).toEqual([a, c, target])
  await expect.poll(async () => (await shownIds(page, 'Qualified')).slice(0, 3)).toEqual([a, c, target])
  await expect.poll(async () => (await shownIds(page, 'New'))[0]).toBe(b)
})

test('a card beside one that has gone loads the board again', async ({ page, problems }) => {
  problems.expect(CONSOLE.conflict)
  await openBoard(page)
  const [first] = await savedIds(page, 'New')
  const [gone] = await savedIds(page, 'Qualified')
  await page.request.delete(`http://127.0.0.1:${API_PORT}/api/deals/${gone}`)
  await dragAbove(page, first!, gone!)
  await expect(message(page, 'The card next to it has moved, so the board has been loaded again.')).toBeVisible()
  await expect(cardLink(page, gone!)).toHaveCount(0)
  await expect.poll(async () => (await shownIds(page, 'New'))[0]).toBe(first)
})

test('new data waits while a card is held', async ({ page }) => {
  await openBoard(page)
  const [first, second] = await savedIds(page, 'New')
  await cardLink(page, first!).focus()
  await page.keyboard.press('Space')
  await expect(card(page, first!)).toHaveCSS('position', 'fixed')
  await page.request.post(`http://127.0.0.1:${API_PORT}/api/deals`, { data: { name: 'Added elsewhere', value: 1, close_date: '2027-02-01' } })
  const loaded = page.waitForResponse('**/api/board')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await loaded
  await expect(head(page, 'New')).toContainText('New16')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Space')
  await expect(head(page, 'New')).toContainText('New17')
  await expect.poll(async () => (await savedIds(page, 'New')).slice(1, 3)).toEqual([second, first])
  await expect.poll(async () => (await shownIds(page, 'New')).slice(1, 3)).toEqual([second, first])
})

test('three quick moves are all kept', async ({ page }) => {
  await openBoard(page)
  const [a, b, c] = await savedIds(page, 'New')
  const targets = [(await savedIds(page, 'Qualified'))[0]!, (await savedIds(page, 'Proposal'))[0]!, (await savedIds(page, 'Negotiation'))[0]!]
  for (const [index, id] of [a, b, c].entries()) await dragAbove(page, id!, targets[index]!)
  await expect.poll(async () => [(await savedIds(page, 'Qualified'))[0], (await savedIds(page, 'Proposal'))[0], (await savedIds(page, 'Negotiation'))[0]]).toEqual([a, b, c])
  await page.reload()
  await expect(cards(page, 'New').first()).toBeVisible()
  expect((await shownIds(page, 'Qualified'))[0]).toBe(a)
  expect((await shownIds(page, 'Proposal'))[0]).toBe(b)
  expect((await shownIds(page, 'Negotiation'))[0]).toBe(c)
})

test('a deal added in a column starts at that stage, on top', async ({ page }) => {
  await openBoard(page)
  for (const [name, probability, closeDate] of [['Proposal', '50', ''], ['Won', '100', '2026-11-24']] as const) {
    await page.getByRole('button', { name: `Add deal in ${name}` }).click()
    await expect(dialog(page).getByRole('combobox', { name: 'Stage' })).toContainText(name)
    await expect(dialog(page).getByLabel('Probability')).toHaveValue(probability)
    await expect(dialog(page).getByLabel('Close date')).toHaveValue(closeDate)
    await dialog(page).getByLabel('Name').fill(`Zebra ${name}`)
    await dialog(page).getByLabel('Value').fill('10000')
    if (!closeDate) await dialog(page).getByLabel('Close date').fill('2027-02-01')
    await dialog(page).getByRole('button', { name: 'Add deal' }).click()
    await expect(cards(page, name).first()).toContainText(`Zebra ${name}`)
  }
})

test('a late card stands out, and a click and Enter open the deal', async ({ page }) => {
  await openBoard(page)
  const late = (await board(page)).columns.flatMap((one) => one.cards).filter(({ days_late }) => days_late)
  expect(late).toHaveLength(4)
  for (const { id, days_late } of late) await expect(card(page, id)).toContainText(`Late ${days_late} day`)

  const [first, second] = await savedIds(page, 'New')
  await card(page, first!).click()
  await expect(page).toHaveURL(`/deals/${first}`)
  await page.goBack()
  await cardLink(page, second!).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`/deals/${second}`)
})
