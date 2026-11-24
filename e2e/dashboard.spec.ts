import type { Page } from '@playwright/test'
import { API_PORT, api, dialog, expect, open, panel, pickStage, test } from './support'

type Deal = { id: number; name: string; stage: string; value: number; probability: number; expected_revenue: number; close_date: string; days_late: number }
type Amount = { value: number; deals: number }
type Entry = { kind: string; id: number; description: string; at: string; record: { name: string; kind: string; id: number } }
type Dashboard = {
  months: (Amount & { month: string })[]
  funnel: (Amount & { stage: string; share: number | null })[]
  follow_ups: (Entry & { follow_up_on: string })[]
  recent: Entry[]
}

const dollars = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`
const sum = (deals: Deal[]) => deals.reduce((total, { value }) => total + value, 0)
const isOpen = ({ stage }: Deal) => !['won', 'lost'].includes(stage)

/** The rows of a chart's table, after showing it. */
async function table(page: Page, heading: string): Promise<string[][]> {
  await panel(page, heading).getByRole('button', { name: `Show table: ${heading}` }).click()
  const rows = panel(page, heading).locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  return rows.evaluateAll((all) => all.map((row) => [...row.children].map((cell) => cell.textContent!)))
}

test('every figure equals what the Deals table adds up to', async ({ page }) => {
  await open(page, '/')
  const deals = await api<Deal[]>(page, '/deals')
  const won = deals.filter(({ stage, close_date }) => stage === 'won' && close_date >= '2025-12-01')
  const wonNow = won.filter(({ close_date }) => close_date >= '2026-11-01')
  const open_ = deals.filter(isOpen)
  const expected = open_.reduce((total, deal) => total + deal.expected_revenue, 0)

  const figures = page.getByRole('region', { name: 'Figures' })
  await expect(figures).toContainText(`Revenue won this month${dollars(sum(wonNow))}${wonNow.length} deals`)
  await expect(figures).toContainText(`Revenue won in 12 months${dollars(sum(won))}${won.length} deals`)
  await expect(figures).toContainText(`Open value${dollars(sum(open_))}${open_.length} deals`)
  await expect(figures).toContainText(`Expected revenue${dollars(expected)}${Math.round((expected / sum(open_)) * 100)}% of open value`)
  await expect(page.getByText('6 follow-ups are overdue and 4 deals are late.')).toBeVisible()

  const names = ['Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026']
  const months = names.map((_, index) => {
    const start = `${index === 0 ? 2025 : 2026}-${String(index === 0 ? 12 : index).padStart(2, '0')}`
    return won.filter(({ close_date }) => close_date.startsWith(start))
  })
  expect(await table(page, 'Revenue won by month')).toEqual(names.map((name, index) => [name, dollars(sum(months[index]!))]))
  expect(await table(page, 'Deals won by month')).toEqual(names.map((name, index) => [name, String(months[index]!.length)]))

  const stages = ['new', 'qualified', 'proposal', 'negotiation'].map((stage) => open_.filter((deal) => deal.stage === stage))
  expect(await table(page, 'Open deals by stage')).toEqual(
    ['New', 'Qualified', 'Proposal', 'Negotiation'].map((name, index) => [
      name,
      String(stages[index]!.length),
      dollars(sum(stages[index]!)),
      dollars(stages[index]!.reduce((total, deal) => total + deal.expected_revenue, 0)),
    ]),
  )

  // How far each deal got, from its own timeline.
  const order = ['new', 'qualified', 'proposal', 'negotiation', 'won']
  const reached = new Map<Deal, number>()
  for (const deal of deals.filter((one) => isOpen(one) || one.close_date >= '2025-12-01')) {
    const changes = (await api<{ kind: string; from_stage: string; to_stage: string }[]>(page, `/deals/${deal.id}/timeline`)).filter(({ kind }) => kind === 'stage_change')
    const lostFrom = changes.find(({ to_stage }) => to_stage === 'lost')?.from_stage ?? 'new'
    reached.set(deal, order.indexOf(deal.stage === 'lost' ? lostFrom : deal.stage))
  }
  const funnel = order.map((_, place) => [...reached].filter(([, furthest]) => furthest >= place).map(([deal]) => deal))
  expect(await table(page, 'How far deals get')).toEqual(
    ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won'].map((name, index) => [
      name,
      dollars(sum(funnel[index]!)),
      String(funnel[index]!.length),
      index ? `${Math.round((sum(funnel[index]!) / sum(funnel[index - 1]!)) * 100)}%` : '',
    ]),
  )
})

test('the figures change after a deal is won', async ({ page }) => {
  await open(page, '/')
  const deals = await api<Deal[]>(page, '/deals')
  const deal = deals.find(({ stage }) => stage === 'negotiation')!
  const wonNow = deals.filter(({ stage, close_date }) => stage === 'won' && close_date >= '2026-11-01')
  const figures = page.getByRole('region', { name: 'Figures' })
  await expect(figures).toContainText(`Revenue won this month${dollars(sum(wonNow))}${wonNow.length} deals`)

  await open(page, `/deals/${deal.id}`)
  await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
  await pickStage(dialog(page), page, 'Won')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(panel(page, 'Timeline').getByRole('listitem').first()).toContainText('Moved from Negotiation to Won')
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click()
  await expect(figures).toContainText(`Revenue won this month${dollars(sum(wonNow) + deal.value)}${wonNow.length + 1} deals`)
  await expect(panel(page, 'Recent activity').getByRole('listitem').first()).toContainText('Moved from Negotiation to Won')
  await expect(panel(page, 'Recent activity').getByRole('heading', { name: 'Today' })).toBeVisible()
  const { funnel } = await api<Dashboard>(page, '/dashboard')
  await expect(panel(page, 'How far deals get').getByRole('img', { name: `Won: ${dollars(funnel[4]!.value)}` })).toBeVisible()
})

test('a new follow-up shows', async ({ page }) => {
  await open(page, '/contacts/1')
  await page.getByRole('button', { name: 'Log activity' }).click()
  await dialog(page).getByLabel('Description').fill('Bring the plans')
  await dialog(page).getByLabel('Follow up on').fill('2026-11-25')
  await dialog(page).getByRole('button', { name: 'Log activity' }).click()
  await expect(dialog(page)).toBeHidden()
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard' }).click()
  const row = panel(page, 'Follow-ups').getByRole('listitem').filter({ hasText: 'Bring the plans' })
  await expect(row).toContainText('Tomorrow')
  await expect(row.getByRole('link', { name: 'Marcus Webb' })).toHaveAttribute('href', '/contacts/1')
})

test('follow-ups are in two groups, in order', async ({ page }) => {
  await open(page, '/')
  const { follow_ups } = await api<Dashboard>(page, '/dashboard')
  const overdue = follow_ups.filter(({ follow_up_on }) => follow_up_on < '2026-11-24')
  const soon = follow_ups.filter(({ follow_up_on }) => follow_up_on >= '2026-11-24')
  for (const [name, group] of [['Overdue', overdue], ['Due in the next 14 days', soon]] as const) {
    const region = panel(page, name)
    await expect(region.getByRole('heading')).toHaveText(`${name} ${group.length}`)
    const texts = await region.getByRole('listitem').allInnerTexts()
    expect(texts.map((text) => text.split('\n')[0])).toEqual(group.map(({ description }) => description))
  }
  await expect(panel(page, 'Overdue').getByRole('listitem').first()).toContainText('8 days')
  await expect(panel(page, 'Overdue').getByRole('listitem').last()).toContainText('1 day')
  await expect(panel(page, 'Due in the next 14 days').getByRole('listitem').first()).toContainText('Today')
})

test('marking one done removes it, and Undo brings it back', async ({ page }) => {
  await open(page, '/')
  const items = panel(page, 'Overdue').getByRole('listitem')
  await expect(items).toHaveCount(6)
  const first = (await items.first().innerText()).split('\n')[0]!
  await items.first().getByRole('checkbox').click()
  await expect(items).toHaveCount(5)
  await expect(page.getByText('5 follow-ups are overdue and 4 deals are late.')).toBeVisible()
  await page.getByRole('dialog').filter({ hasText: `Done: ${first}` }).getByRole('button', { name: 'Undo' }).click()
  await expect(items).toHaveCount(6)
  await expect(items.first()).toContainText(first)
  await expect(items.first().getByRole('checkbox')).not.toBeChecked()

  await items.first().getByRole('checkbox').click()
  await expect(items).toHaveCount(5)
  await page.reload()
  await expect(items).toHaveCount(5)
})

test('recent activity is the newest ten, linked', async ({ page }) => {
  await open(page, '/')
  const { recent } = await api<Dashboard>(page, '/dashboard')
  const items = panel(page, 'Recent activity').getByRole('listitem')
  await expect(items).toHaveCount(10)
  for (const [index, { record }] of recent.entries()) {
    await expect(items.nth(index).getByRole('link', { name: record.name })).toHaveAttribute('href', `/${record.kind}s/${record.id}`)
  }
  await items.first().getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(recent[0]!.record.name)
})

test('a month without a deal shows zero on both charts', async ({ page }) => {
  for (const { id, close_date } of await api<Deal[]>(page, '/deals')) {
    if (close_date < '2026-09-01' || close_date > '2026-09-30') await page.request.delete(`http://127.0.0.1:${API_PORT}/api/deals/${id}`)
  }
  const { months } = await api<Dashboard>(page, '/dashboard')
  expect(months.filter(({ deals }) => deals).map(({ month }) => month)).toEqual(['2026-09-01'])
  const numbers = panel(page, 'Deals won by month').locator('.recharts-label-list text')
  await open(page, '/')
  await expect(numbers).toHaveText(months.map(({ deals }) => String(deals)))
  await expect(panel(page, 'Revenue won by month')).toContainText('$0') // This month's, beside its point.

  for (const { id } of await api<Deal[]>(page, '/deals')) await page.request.delete(`http://127.0.0.1:${API_PORT}/api/deals/${id}`)
  await page.reload()
  await expect(numbers).toHaveText(Array(12).fill('0'))
  for (const tick of ['$50K', '$100K']) await expect(panel(page, 'Revenue won by month').getByText(tick, { exact: true })).toBeVisible()
})

test('the best month is written in full, also at the top of the axis', async ({ page }) => {
  for (const { id } of await api<Deal[]>(page, '/deals')) await page.request.delete(`http://127.0.0.1:${API_PORT}/api/deals/${id}`)
  for (const value of [9_000, 100_000, 999_999_999]) {
    await page.request.post(`http://127.0.0.1:${API_PORT}/api/deals`, { data: { name: 'One', value, stage: 'won', close_date: '2026-09-10' } })
    await open(page, '/')
    const best = Math.max(...(await api<Dashboard>(page, '/dashboard')).months.map((month) => month.value))
    const label = (await panel(page, 'Revenue won by month').locator('svg text').getByText(dollars(best), { exact: true }).boundingBox())!
    const chart = (await panel(page, 'Revenue won by month').locator('svg.recharts-surface').first().boundingBox())!
    expect(label.y, dollars(best)).toBeGreaterThanOrEqual(chart.y)
  }
})

test('each chart shows its table and back', async ({ page }) => {
  await open(page, '/')
  for (const heading of ['Revenue won by month', 'Deals won by month', 'How far deals get', 'Open deals by stage']) {
    await table(page, heading)
    await panel(page, heading).getByRole('button', { name: `Show chart: ${heading}` }).click()
    await expect(panel(page, heading).getByRole('table')).toHaveCount(0)
    await expect(panel(page, heading).getByRole('button', { name: `Show table: ${heading}` })).toBeVisible()
  }
})

test('a tooltip by mouse and by keyboard, on every chart', async ({ page }) => {
  await open(page, '/')
  const { months, funnel } = await api<Dashboard>(page, '/dashboard')

  for (const heading of ['Revenue won by month', 'Deals won by month']) {
    const chart = panel(page, heading).locator('svg.recharts-surface').first()
    const box = (await chart.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const tip = panel(page, heading).locator('.recharts-tooltip-wrapper')
    await expect(tip).toContainText(/\w{3} 202\d\$[\d,]+\d+ deals?/)
    await page.mouse.move(5, 5)
    await expect(tip).toBeHidden()

    await chart.focus()
    await page.keyboard.press('ArrowRight')
    await expect(tip).toBeVisible()
    await expect(tip).toContainText(`Jan 2026${dollars(months[1]!.value)}`)
    await page.keyboard.press('ArrowRight')
    await expect(tip).toContainText(`Feb 2026${dollars(months[2]!.value)}`)
    await page.mouse.click(5, 5)
  }

  const funnelPart = panel(page, 'How far deals get').getByRole('img', { name: /^Qualified/ })
  const funnelTip = page.getByText('80% of New', { exact: true })
  await funnelPart.hover()
  await expect(funnelTip).toBeVisible()
  await page.mouse.move(5, 5)
  await expect(funnelTip).toBeHidden()
  await panel(page, 'How far deals get').getByRole('button').focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(funnelPart).toBeFocused()
  await expect(funnelTip).toBeVisible()
  expect(Math.round(funnel[1]!.share! * 100)).toBe(80)

  const bar = panel(page, 'Open deals by stage').getByRole('img', { name: /^Proposal/ })
  await bar.hover()
  await expect(page.getByText(/^\$[\d,]+ open value$/)).toBeVisible()
  await page.mouse.move(5, 5)
  await bar.focus()
  await expect(page.getByText(/^\$[\d,]+ open value$/)).toBeVisible()
})

test('add a deal', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('button', { name: 'Add deal' }).click()
  await dialog(page).getByLabel('Name').fill('Zebra system')
  await dialog(page).getByLabel('Value').fill('100000')
  await dialog(page).getByLabel('Close date').fill('2027-02-01')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(page.getByRole('region', { name: 'Figures' })).toContainText('45 deals')
})
