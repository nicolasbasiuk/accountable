import { API_PORT, api, column, dialog, expect, open, panel, pick, question, rows, search, test } from './support'

type Organization = { id: number; name: string; contacts: number; open_value: number }

test('add, find, edit and delete from the table', async ({ page }) => {
  await open(page, '/organizations')
  await expect(page.getByRole('status')).toHaveText('24 organizations')

  await page.getByRole('button', { name: 'Add organization' }).click()
  await dialog(page).getByLabel('Name').fill('Zenith Robotics')
  await dialog(page).getByLabel('Website').fill('zenith.example')
  await dialog(page).getByLabel('Industry').fill('Robotics')
  await dialog(page).getByLabel('Notes').fill('Met at a fair.')
  await dialog(page).getByRole('button', { name: 'Add organization' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('status')).toHaveText('25 organizations')
  await expect(page.getByText('Added Zenith Robotics.')).toBeVisible()

  await search(page).fill('zenITH')
  await expect(page.getByRole('status')).toHaveText('1 of 25 organizations')
  await expect(page.getByRole('link', { name: 'zenith.example' })).toHaveAttribute('href', 'https://zenith.example')

  await page.getByRole('button', { name: 'Edit Zenith Robotics' }).click()
  await expect(dialog(page).getByLabel('Notes')).toHaveValue('Met at a fair.')
  await dialog(page).getByLabel('Industry').fill('Manufacturing')
  await dialog(page).getByLabel('Industry').press('Tab') // Closes the suggestions.
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(rows(page).first()).toContainText('Manufacturing')
  await page.reload()
  await expect(rows(page).first()).toContainText('Manufacturing')
  await expect(rows(page).first()).toContainText('zenith.example')

  await page.getByRole('button', { name: 'Delete Zenith Robotics' }).click()
  await expect(question(page)).toContainText('Delete Zenith Robotics?')
  await question(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'Delete Zenith Robotics' }).click()
  await question(page).getByRole('button', { name: 'Delete organization' }).click()
  await expect(page.getByText('No organizations match.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Show all organizations' }).click()
  await expect(page.getByRole('status')).toHaveText('24 organizations')
})

test('sort by every heading, both ways', async ({ page }) => {
  await open(page, '/organizations')
  const all = await api<Organization[]>(page, '/organizations')
  const byName = all.map(({ name }) => name).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  await expect(rows(page).first()).toContainText(byName[0]!)
  expect(await column(page, 'Name')).toEqual(byName)

  for (const heading of ['Industry', 'Website', 'Contacts', 'Open deals', 'Open value', 'Name']) {
    const value = (text: string) => (/^[$\d]/.test(text) ? Number(text.replace(/[$,]/g, '')) : text.toLowerCase())
    const inOrder = (texts: string[]) => texts.map(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    await page.getByRole('button', { name: heading, exact: true }).click()
    await expect(page.getByRole('columnheader', { name: heading })).toHaveAttribute('aria-sort', 'ascending')
    const ascending = await column(page, heading)
    expect(ascending.map(value)).toEqual(inOrder(ascending))
    await page.getByRole('button', { name: heading, exact: true }).click()
    await expect(page.getByRole('columnheader', { name: heading })).toHaveAttribute('aria-sort', 'descending')
    expect((await column(page, heading)).map(value)).toEqual(inOrder(ascending).reverse())
  }
})

test('search and sort are still there after opening a record and going back', async ({ page }) => {
  await open(page, '/organizations')
  await search(page).fill('transport')
  await page.getByRole('button', { name: 'Open value' }).click()
  const order = await column(page, 'Name')
  expect(order).toHaveLength(3)
  await rows(page).first().getByText('Transport').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(order[0]!)
  await page.goBack()
  await expect(search(page)).toHaveValue('transport')
  expect(await column(page, 'Name')).toEqual(order)
  await page.reload()
  expect(await column(page, 'Name')).toEqual(order)
  // The sidebar's link starts again.
  await page.getByRole('navigation').getByRole('link', { name: 'Organizations' }).click()
  await expect(page.getByRole('status')).toHaveText('24 organizations')
  await expect(search(page)).toHaveValue('')
})

test('the page shows what is linked, and adds already linked', async ({ page }) => {
  await open(page, '/organizations/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upland Water')
  const before = await api<{ contacts: { name: string }[]; deals: { name: string }[]; value_won: number }>(page, '/organizations/1')
  for (const { name } of before.contacts) await expect(panel(page, 'Contacts')).toContainText(name)
  await expect(panel(page, 'Deals').getByRole('listitem')).toHaveCount(before.deals.length)
  await expect(panel(page, 'Details')).toContainText(`$${before.value_won.toLocaleString('en-US')}`)

  await page.getByRole('button', { name: 'Add contact' }).click()
  await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Upland Water')
  await dialog(page).getByLabel('Name').fill('Zoe Marsh')
  await dialog(page).getByRole('button', { name: 'Add contact' }).click()
  await expect(panel(page, 'Contacts').getByRole('link', { name: 'Zoe Marsh' })).toBeVisible()

  await page.getByRole('button', { name: 'Add deal' }).click()
  await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Upland Water')
  await dialog(page).getByLabel('Name').fill('Zebra system')
  await dialog(page).getByLabel('Value').fill('12,500')
  await dialog(page).getByLabel('Close date').fill('2027-02-01')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await panel(page, 'Deals').getByRole('link', { name: 'Zebra system' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zebra system')
  await expect(panel(page, 'Details').getByRole('link', { name: 'Upland Water' })).toBeVisible()
})

test('deleting keeps its contacts and deals, without the link', async ({ page }) => {
  await open(page, '/organizations/1')
  const before = await api<{ contacts: { id: number; name: string }[]; deals: { id: number; name: string }[] }>(page, '/organizations/1')
  await panel(page, 'Details').getByRole('button', { name: 'Delete' }).click()
  await expect(question(page)).toContainText(`${before.contacts.length} contacts and ${before.deals.length} deals are kept, with no organization.`)
  await question(page).getByRole('button', { name: 'Delete organization' }).click()

  await expect(page).toHaveURL('/organizations')
  await expect(page.getByRole('status')).toHaveText('23 organizations')
  for (const { id, name } of before.contacts) {
    await open(page, `/contacts/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(panel(page, 'Details')).not.toContainText('Organization')
  }
  for (const { id, name } of before.deals) {
    await open(page, `/deals/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(panel(page, 'Details')).not.toContainText('Organization')
  }
})

test('edit from its page', async ({ page }) => {
  await open(page, '/organizations/1')
  await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
  await dialog(page).getByLabel('Name').fill('Upland Waterworks')
  await dialog(page).getByLabel('Industry').fill('')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upland Waterworks')
  await expect(panel(page, 'Details')).not.toContainText('Industry')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upland Waterworks')
  await expect(page).toHaveTitle(/Upland Waterworks/)
})

test('the industry suggests those in use', async ({ page }) => {
  await open(page, '/organizations')
  await page.getByRole('button', { name: 'Add organization' }).click()
  await dialog(page).getByLabel('Industry').fill('heal')
  await page.getByRole('option', { name: 'Healthcare' }).click()
  await expect(dialog(page).getByLabel('Industry')).toHaveValue('Healthcare')
})

test('a wrong value shows its problem, and closing with changes asks', async ({ page }) => {
  await open(page, '/organizations')
  await page.getByRole('button', { name: 'Add organization' }).click()
  await dialog(page).getByLabel('Website').fill('javascript:alert(1)')
  await dialog(page).getByRole('button', { name: 'Add organization' }).click()
  await expect(dialog(page).getByLabel('Name')).toHaveAccessibleDescription('Enter a name.')
  await expect(dialog(page).getByLabel('Website')).toHaveAccessibleDescription('Enter a website address, such as example.com.')

  await page.keyboard.press('Escape')
  await expect(question(page)).toContainText('Discard your changes?')
  await question(page).getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog(page).getByLabel('Website')).toHaveValue('javascript:alert(1)')
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await question(page).getByRole('button', { name: 'Discard changes' }).click()
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('status')).toHaveText('24 organizations')
})

test("a change made in a second tab shows when this one gets the focus", async ({ page, context }) => {
  await open(page, '/organizations/1')
  const second = await context.newPage()
  await open(second, '/organizations/1')
  await panel(second, 'Details').getByRole('button', { name: 'Edit' }).click()
  await dialog(second).getByLabel('Name').fill('Renamed elsewhere')
  await dialog(second).getByRole('button', { name: 'Save changes' }).click()
  await expect(second.getByRole('heading', { level: 1 })).toHaveText('Renamed elsewhere')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upland Water')
  // Playwright's tabs all think they're in front, so the browser's own event is sent by hand.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Renamed elsewhere')
})

test('an edit sends only what was changed, also if the organization was changed elsewhere meanwhile', async ({ page }) => {
  await open(page, '/organizations/1')
  await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
  await dialog(page).getByLabel('Website').fill('upland.example')

  await page.request.patch(`http://127.0.0.1:${API_PORT}/api/organizations/1`, { data: { notes: 'Written elsewhere.' } })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('section[aria-label=Details]')).toContainText('Written elsewhere.')

  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog(page)).toBeHidden()
  expect(await api(page, '/organizations/1')).toMatchObject({ website: 'upland.example', notes: 'Written elsewhere.' })
})

test('going back, or leaving, with unsaved changes asks', async ({ page }) => {
  await open(page, '/contacts')
  await page.getByRole('navigation').getByRole('link', { name: 'Organizations' }).click()
  await page.getByRole('button', { name: 'Add organization' }).click()
  await dialog(page).getByLabel('Name').fill('Half entered')

  await page.goBack()
  await expect(question(page)).toContainText('Discard your changes?')
  await expect(page).toHaveURL(/\/organizations$/)
  await question(page).getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog(page).getByLabel('Name')).toHaveValue('Half entered')

  // Leaving the app altogether, which only the browser can ask about.
  const asked = page.waitForEvent('dialog')
  await page.evaluate(() => void setTimeout(() => location.reload()))
  const leave = await asked
  expect(leave.type()).toBe('beforeunload')
  await leave.dismiss()
  await expect(dialog(page).getByLabel('Name')).toHaveValue('Half entered')

  await page.goBack()
  await question(page).getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contacts')
  await expect(dialog(page)).toBeHidden()
})

test('going back with nothing entered, or after saving, does not ask', async ({ page }) => {
  await open(page, '/contacts')
  await page.getByRole('navigation').getByRole('link', { name: 'Organizations' }).click()
  await page.getByRole('button', { name: 'Add organization' }).click()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contacts')

  await page.getByRole('navigation').getByRole('link', { name: 'Organizations' }).click()
  await page.getByRole('button', { name: 'Add organization' }).click()
  await dialog(page).getByLabel('Name').fill('Entered')
  await dialog(page).getByRole('button', { name: 'Add organization' }).click()
  await expect(page.getByRole('status')).toHaveText('25 organizations')
  await expect(dialog(page)).toBeHidden()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contacts')
})

test('a contact picker in a form can be cleared', async ({ page }) => {
  await open(page, '/organizations/1')
  await page.getByRole('button', { name: 'Add deal' }).click()
  await pick(dialog(page), page, 'Main contact', 'Marcus Webb')
  await dialog(page).getByRole('button', { name: 'Clear contact' }).click()
  await expect(dialog(page).getByRole('combobox', { name: 'Main contact' })).toHaveValue('')
  await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Upland Water')
})
