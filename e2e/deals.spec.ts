import { api, column, dialog, expect, open, panel, pick, pickStage, question, rows, search, test } from './support'

type Deal = { id: number; name: string; stage: string; probability: number; close_date: string; days_late: number; value: number }

test('add, find, edit and delete from the table', async ({ page }) => {
  await open(page, '/deals')
  await expect(page.getByRole('status')).toHaveText('96 deals')

  await page.getByRole('button', { name: 'Add deal' }).click()
  await dialog(page).getByLabel('Name').fill('Zebra system')
  await pick(dialog(page), page, 'Organization', 'Upland Water')
  await pick(dialog(page), page, 'Main contact', 'Marcus Webb')
  await dialog(page).getByLabel('Value').fill('$12,500')
  await dialog(page).getByLabel('Close date').fill('2027-02-01')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(page.getByRole('status')).toHaveText('97 deals')

  await search(page).fill('zebra')
  await expect(rows(page)).toHaveCount(1)
  for (const text of ['Upland Water', 'Marcus Webb', 'New', '$12,500', '10%', '$1,250', 'Feb 1, 2027']) await expect(rows(page)).toContainText(text)

  await page.getByRole('button', { name: 'Edit Zebra system' }).click()
  await expect(dialog(page).getByLabel('Value')).toHaveValue('12,500')
  await dialog(page).getByLabel('Value').fill('20000')
  await dialog(page).getByLabel('Probability').fill('15')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(rows(page)).toContainText('$3,000')
  await page.reload()
  for (const text of ['$20,000', '15%', '$3,000', 'New']) await expect(rows(page)).toContainText(text)

  await page.getByRole('button', { name: 'Delete Zebra system' }).click()
  await question(page).getByRole('button', { name: 'Delete deal' }).click()
  await expect(page.getByText('No deals match.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Show all deals' }).click()
  await expect(page.getByRole('status')).toHaveText('96 deals')
})

test('searches the listed fields', async ({ page }) => {
  await open(page, '/deals')
  const all = await api<(Deal & { organization: { name: string } | null; contact: { name: string } | null })[]>(page, '/deals')
  for (const [text, matches] of [
    ['negotiation', all.filter(({ stage }) => stage === 'negotiation')],
    ['UPLAND', all.filter(({ organization }) => organization?.name.includes('Upland'))],
    ['marcus', all.filter(({ contact }) => contact?.name.includes('Marcus'))],
  ] as const) {
    await search(page).fill(text)
    await expect(page.getByRole('status')).toHaveText(`${matches.length} of 96 deals`)
  }
})

test('sort by every heading, both ways', async ({ page }) => {
  await open(page, '/deals')
  const order = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
  const value = (heading: string, text: string) => {
    if (heading === 'Stage') return order.indexOf(text)
    if (heading === 'Close date') return Date.parse(text.split('\n')[0]!)
    return /^[$\d]/.test(text) ? Number(text.replace(/[$,%]/g, '')) : text.toLowerCase()
  }
  const inOrder = (heading: string, texts: string[]) =>
    texts.filter((text) => text).map((text) => value(heading, text)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  // Close date first, latest first.
  const first = await column(page, 'Close date')
  expect(first.map((text) => value('Close date', text))).toEqual(inOrder('Close date', first).reverse())

  for (const heading of ['Name', 'Organization', 'Main contact', 'Stage', 'Value', 'Probability', 'Expected revenue', 'Close date']) {
    await page.getByRole('button', { name: heading, exact: true }).click()
    const ascending = await column(page, heading.split(' ')[0]!)
    const blanks = ascending.filter((text) => !text)
    expect(ascending.map((text) => text && value(heading, text))).toEqual([...inOrder(heading, ascending), ...blanks])
    await page.getByRole('button', { name: heading, exact: true }).click()
    expect((await column(page, heading.split(' ')[0]!)).map((text) => text && value(heading, text))).toEqual([...inOrder(heading, ascending).reverse(), ...blanks])
  }
})

test('a late deal stands out in the table and on its page', async ({ page }) => {
  await open(page, '/deals')
  const late = (await api<Deal[]>(page, '/deals')).filter(({ days_late }) => days_late)
  expect(late).toHaveLength(4)
  await expect(page.getByText(/^Late \d+ days?$/)).toHaveCount(4)
  await open(page, `/deals/${late[0]!.id}`)
  await expect(panel(page, 'Details')).toContainText(`Late ${late[0]!.days_late} days`)
})

test('the stage fills in the probability and close date, and both can be changed', async ({ page }) => {
  await open(page, '/deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  const form = dialog(page)
  await expect(form.getByLabel('Probability')).toHaveValue('10')
  await form.getByLabel('Name').fill('Zebra system')
  await form.getByLabel('Value').fill('10000')
  await form.getByLabel('Close date').fill('2027-02-01')

  await pickStage(form, page, 'Proposal')
  await expect(form.getByLabel('Probability')).toHaveValue('50')
  await expect(form.getByLabel('Close date')).toHaveValue('2027-02-01')
  await pickStage(form, page, 'Won')
  await expect(form.getByLabel('Probability')).toHaveValue('100')
  await expect(form.getByLabel('Probability')).not.toBeEditable()
  await expect(form.getByLabel('Close date')).toHaveValue('2026-11-24')
  // Chosen by mistake: the date comes back.
  await pickStage(form, page, 'Negotiation')
  await expect(form.getByLabel('Probability')).toHaveValue('75')
  await expect(form.getByLabel('Close date')).toHaveValue('2027-02-01')

  await pickStage(form, page, 'Lost')
  await expect(form.getByLabel('Probability')).toHaveValue('0')
  await form.getByLabel('Close date').fill('2026-12-25')
  await form.getByRole('button', { name: 'Add deal' }).click()
  await expect(form.getByLabel('Close date')).toHaveAccessibleDescription("A lost deal's close date can't be after today.")
  await form.getByLabel('Close date').fill('2026-11-02')
  await form.getByRole('button', { name: 'Add deal' }).click()
  await search(page).fill('zebra')
  for (const text of ['Lost', '0%', 'Nov 2, 2026']) await expect(rows(page)).toContainText(text)
})

test('a value set back by hand is kept', async ({ page }) => {
  const deal = (await api<Deal[]>(page, '/deals')).find(({ stage, probability }) => stage === 'proposal' && probability === 50)!
  await open(page, `/deals/${deal.id}`)
  await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
  await pickStage(dialog(page), page, 'Negotiation')
  await expect(dialog(page).getByLabel('Probability')).toHaveValue('75')
  await dialog(page).getByLabel('Probability').fill('50')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(panel(page, 'Details')).toContainText('50%')
  await expect(page.getByRole('list', { name: 'Stage' }).locator('[aria-current=step]')).toHaveText('Negotiation')
  expect(await api<Deal>(page, `/deals/${deal.id}`)).toMatchObject({ stage: 'negotiation', probability: 50, close_date: deal.close_date })
})

test('winning from the form makes the main contact a customer', async ({ page }) => {
  await open(page, '/contacts')
  await page.getByRole('button', { name: 'Add contact' }).click()
  await dialog(page).getByLabel('Name').fill('Zoe Marsh')
  await pick(dialog(page), page, 'Organization', 'Upland Water')
  await dialog(page).getByRole('button', { name: 'Add contact' }).click()
  await search(page).fill('zoe')
  await rows(page).first().getByText('Zoe Marsh').click()
  await page.getByRole('button', { name: 'Add deal' }).click()
  await dialog(page).getByLabel('Name').fill('Zebra system')
  await dialog(page).getByLabel('Value').fill('10000')
  await pickStage(dialog(page), page, 'Won')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(panel(page, 'Details')).toContainText('Customer')
  await expect(panel(page, 'Deals')).toContainText('Zebra system')
})

test("the organization's contacts come first, and a contact fills in the organization", async ({ page }) => {
  await open(page, '/deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  await pick(dialog(page), page, 'Main contact', 'Priya Nair')
  await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Juniper Retail Group')
  // A chosen organization stays.
  await pick(dialog(page), page, 'Main contact', 'Marcus Webb')
  await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Juniper Retail Group')

  await dialog(page).getByRole('button', { name: 'Clear contact' }).click()
  await dialog(page).getByRole('button', { name: 'Show every contact' }).click()
  await expect(page.getByRole('listbox').getByRole('group').first()).toContainText('At Juniper Retail Group')
  await expect(page.getByRole('option').first()).toContainText('Juniper Retail Group')
})

test('a wrong value shows its problem', async ({ page }) => {
  await open(page, '/deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  await dialog(page).getByLabel('Value').fill('-5')
  await dialog(page).getByLabel('Probability').fill('101')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(dialog(page).getByLabel('Name')).toHaveAccessibleDescription('Enter a name.')
  await expect(dialog(page).getByLabel('Value')).toHaveAccessibleDescription('Enter a value of $0 or more.')
  await expect(dialog(page).getByLabel('Probability')).toHaveAccessibleDescription('Enter a probability from 0 to 100.')
  await expect(dialog(page).getByLabel('Close date')).toHaveAccessibleDescription('Enter a close date.')
})

test('delete from its page', async ({ page }) => {
  await open(page, '/deals/1')
  const { activities, follow_ups } = await api<{ activities: number; follow_ups: number }>(page, '/deals/1/deletion')
  await panel(page, 'Details').getByRole('button', { name: 'Delete' }).click()
  await expect(question(page)).toContainText(`${activities} activities are deleted, ${follow_ups} with a follow-up still to do.`)
  await question(page).getByRole('button', { name: 'Delete deal' }).click()
  await expect(page).toHaveURL('/deals')
  await expect(page.getByRole('status')).toHaveText('95 deals')
})
