import { api, dialog, expect, open, panel, pickStage, question, test } from './support'
import type { Page } from '@playwright/test'

type Deal = { id: number; name: string; stage: string; organization: { id: number; name: string }; contact: { id: number; name: string } | null }

/** An open deal with a main contact, for the tests to work with. */
async function someDeal(page: Page) {
  const deals = await api<Deal[]>(page, '/deals')
  const deal = deals.find(({ stage, contact }) => stage === 'proposal' && contact)!
  return { ...deal, contact: deal.contact! }
}

const items = (page: Page) => panel(page, 'Timeline').getByRole('listitem')

async function log(page: Page, type: string, description: string, followUp?: string) {
  await page.getByRole('button', { name: 'Log activity' }).click()
  await dialog(page).getByText(type, { exact: true }).click()
  await dialog(page).getByLabel('Description').fill(description)
  if (followUp) await dialog(page).getByLabel('Follow up on').fill(followUp)
  await dialog(page).getByRole('button', { name: 'Log activity' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(items(page).first()).toContainText(description)
}

test('a note, call and email on a deal, newest first, also on its contact and organization', async ({ page }) => {
  const deal = await someDeal(page)
  await open(page, `/deals/${deal.id}`)
  const before = await items(page).count()
  for (const type of ['Note', 'Call', 'Email']) await log(page, type, `A new ${type.toLowerCase()}`)
  await expect(items(page)).toHaveCount(before + 3)
  for (const [index, text] of ['A new email', 'A new call', 'A new note'].entries()) await expect(items(page).nth(index)).toContainText(text)

  await open(page, `/contacts/${deal.contact.id}`)
  await expect(items(page).first()).toContainText('A new email')
  await expect(items(page).first().getByRole('link', { name: deal.name })).toHaveAttribute('href', `/deals/${deal.id}`)
  await open(page, `/organizations/${deal.organization.id}`)
  await expect(items(page).filter({ hasText: 'A new email' })).toHaveCount(1)
  await page.reload()
  await expect(items(page).first()).toContainText('A new email')
})

test("one on a contact doesn't show on their deals", async ({ page }) => {
  const deal = await someDeal(page)
  await open(page, `/contacts/${deal.contact.id}`)
  for (const type of ['Note', 'Call', 'Email']) await log(page, type, `A new ${type.toLowerCase()}`)
  await open(page, `/organizations/${deal.organization.id}`)
  await expect(items(page).first().getByRole('link', { name: deal.contact.name })).toBeVisible()
  await open(page, `/deals/${deal.id}`)
  await expect(items(page).first()).toBeVisible()
  await expect(items(page).filter({ hasText: 'A new' })).toHaveCount(0)
})

test('when it happened can be changed, but not to the future', async ({ page }) => {
  const deal = await someDeal(page)
  await open(page, `/deals/${deal.id}`)
  await page.getByRole('button', { name: 'Log activity' }).click()
  // "Now" is the server's, which is on the tests' fixed day.
  await expect(dialog(page).getByLabel('Happened')).toHaveValue(/^2026-11-24T/)
  await dialog(page).getByLabel('Description').fill('Long ago')
  await dialog(page).getByLabel('Happened').fill('2026-11-25T09:00')
  await dialog(page).getByRole('button', { name: 'Log activity' }).click()
  await expect(dialog(page).getByLabel('Happened')).toHaveAccessibleDescription("This can't be in the future.")
  await dialog(page).getByLabel('Happened').fill('2020-01-02T09:00')
  await dialog(page).getByRole('button', { name: 'Log activity' }).click()
  await expect(items(page).last()).toContainText('Long ago')
  await expect(items(page).last()).toContainText('Jan 2, 2020, 9:00 AM')
})

test('edit and delete, from a timeline of another record too', async ({ page }) => {
  const deal = await someDeal(page)
  await open(page, `/deals/${deal.id}`)
  await log(page, 'Call', 'First call', '2026-12-01')

  await open(page, `/organizations/${deal.organization.id}`)
  await page.getByRole('button', { name: 'Edit "First call"' }).click()
  await dialog(page).getByLabel('Description').fill('Second call')
  await dialog(page).getByText('Email', { exact: true }).click()
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(items(page).first()).toContainText('Second call')
  await expect(items(page).first()).toContainText('Email,')

  await open(page, `/contacts/${deal.contact.id}`)
  await expect(items(page).first()).toContainText('Second call')
  await page.getByRole('button', { name: 'Delete "Second call"' }).click()
  await expect(question(page)).toContainText("Its follow-up is deleted too. This can't be undone.")
  await question(page).getByRole('button', { name: 'Delete activity' }).click()
  await expect(items(page).filter({ hasText: 'Second call' })).toHaveCount(0)
  await page.reload()
  await expect(items(page).first()).toBeVisible()
  await expect(items(page).filter({ hasText: 'Second call' })).toHaveCount(0)
})

test('done and not done', async ({ page }) => {
  const deal = await someDeal(page)
  await open(page, `/deals/${deal.id}`)
  await log(page, 'Call', 'Overdue call', '2026-11-20')
  await expect(items(page).first()).toContainText('Overdue 4 days')
  const box = page.getByRole('checkbox', { name: 'Done: Overdue call' })
  await box.check()
  await expect(items(page).first()).not.toContainText('Overdue 4')
  await page.reload()
  await expect(box).toBeChecked()
  await box.uncheck()
  await page.reload()
  await expect(box).not.toBeChecked()
  await expect(items(page).first()).toContainText('Overdue 4 days')
})

test('a change of stage shows on the deal, its contact and its organization, with no actions', async ({ page }) => {
  const deal = await someDeal(page)
  await open(page, `/deals/${deal.id}`)
  await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
  await pickStage(dialog(page), page, 'Negotiation')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  for (const address of [`/deals/${deal.id}`, `/contacts/${deal.contact.id}`, `/organizations/${deal.organization.id}`]) {
    await open(page, address)
    await expect(items(page).first()).toContainText('Moved from Proposal to Negotiation')
    await expect(items(page).first().getByRole('button')).toHaveCount(0)
  }
})
