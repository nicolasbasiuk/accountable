import { api, column, CONSOLE, dialog, expect, open, panel, pick, question, rows, search, test } from './support'

type Contact = { id: number; name: string; status: string; organization: { id: number; name: string } | null }

test('add, find, edit and delete from the table', async ({ page }) => {
  await open(page, '/contacts')
  await expect(page.getByRole('status')).toHaveText('60 contacts')

  await page.getByRole('button', { name: 'Add contact' }).click()
  await dialog(page).getByLabel('Name').fill('Zoe Marsh')
  await dialog(page).getByLabel('Job title').fill('Buyer')
  await dialog(page).getByLabel('Email').fill('zoe@upland.example')
  await dialog(page).getByLabel('Phone').fill('(303) 555-0199')
  await pick(dialog(page), page, 'Organization', 'Upland Water')
  await dialog(page).getByText('Qualified').click()
  await dialog(page).getByRole('button', { name: 'Add contact' }).click()
  await expect(page.getByRole('status')).toHaveText('61 contacts')

  for (const text of ['zoe m', 'buyer', 'ZOE@UPLAND', '555-0199']) {
    await search(page).fill(text)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText('Zoe Marsh')
  }
  await expect(rows(page)).toContainText('Upland Water')
  await expect(rows(page)).toContainText('Qualified')

  await page.getByRole('button', { name: 'Edit Zoe Marsh' }).click()
  await dialog(page).getByText('Customer').click()
  await dialog(page).getByLabel('Job title').fill('')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(rows(page)).toContainText('Customer')
  await page.reload()
  await expect(rows(page)).toContainText('Customer')
  await expect(rows(page)).not.toContainText('Buyer')

  await page.getByRole('button', { name: 'Delete Zoe Marsh' }).click()
  await expect(question(page)).toContainText("Delete Zoe Marsh?This can't be undone.")
  await question(page).getByRole('button', { name: 'Delete contact' }).click()
  await expect(page.getByText('No contacts match.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Show all contacts' }).click()
  await expect(page.getByRole('status')).toHaveText('60 contacts')
})

test('sort by every heading, both ways', async ({ page }) => {
  await open(page, '/contacts')
  const firstLine = (texts: string[]) => texts.map((text) => text.split('\n')[0]!)
  for (const heading of ['Organization', 'Email', 'Phone', 'Last activity', 'Next follow-up', 'Status', 'Name']) {
    const order = ['Lead', 'Qualified', 'Customer']
    const value = (text: string) => {
      if (heading === 'Status') return order.indexOf(text)
      return /^[A-Z][a-z]{2} \d/.test(text) ? Date.parse(text) : text.replace(/\s/g, '').toLowerCase()
    }
    const inOrder = (texts: string[]) =>
      texts.filter((text) => text).map(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    await page.getByRole('button', { name: heading, exact: true }).click()
    const ascending = firstLine(await column(page, heading))
    const blanks = ascending.filter((text) => !text)
    expect(ascending.map((text) => text && value(text))).toEqual([...inOrder(ascending), ...blanks])
    await page.getByRole('button', { name: heading, exact: true }).click()
    // Blanks stay last.
    expect(firstLine(await column(page, heading)).map((text) => text && value(text))).toEqual([...inOrder(ascending).reverse(), ...blanks])
  }
})

test('filter by status, together with a search', async ({ page }) => {
  await open(page, '/contacts')
  const all = await api<Contact[]>(page, '/contacts')
  const amount = (status: string) => all.filter((contact) => contact.status === status).length
  const filter = page.getByRole('group', { name: 'Status' })
  await expect(filter).toContainText(`All 60`)
  await expect(filter).toContainText(`Lead ${amount('lead')}`)
  await filter.getByRole('button', { name: /Customer/ }).click()
  await expect(rows(page)).toHaveCount(amount('customer'))
  expect(new Set(await column(page, 'Status'))).toEqual(new Set(['Customer']))

  await search(page).fill('upland')
  const matching = all.filter(({ organization }) => organization?.name === 'Upland Water')
  await expect(filter).toContainText(`All ${matching.length}`)
  await expect(rows(page)).toHaveCount(matching.filter(({ status }) => status === 'customer').length)

  await page.reload()
  await expect(search(page)).toHaveValue('upland')
  await expect(filter.getByRole('button', { name: /Customer/ })).toHaveAttribute('aria-pressed', 'true')
})

test('the page shows what is linked, and adds a deal already linked', async ({ page }) => {
  await open(page, '/contacts/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marcus Webb')
  await expect(panel(page, 'Details').getByRole('link', { name: 'Upland Water' })).toBeVisible()
  const before = await api<{ deals: { name: string }[] }>(page, '/contacts/1')
  await expect(panel(page, 'Deals').getByRole('listitem')).toHaveCount(before.deals.length)

  await page.getByRole('button', { name: 'Add deal' }).click()
  await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Upland Water')
  await expect(dialog(page).getByRole('combobox', { name: 'Main contact' })).toHaveValue('Marcus Webb')
  await dialog(page).getByLabel('Name').fill('Zebra system')
  await dialog(page).getByLabel('Value').fill('12500')
  await dialog(page).getByLabel('Close date').fill('2027-02-01')
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(panel(page, 'Deals').getByRole('link', { name: 'Zebra system' })).toBeVisible()
})

test('deleting from its page keeps the deals, without the link', async ({ page }) => {
  await open(page, '/contacts/1')
  const { deals } = await api<{ deals: { id: number; name: string }[] }>(page, '/contacts/1')
  await panel(page, 'Details').getByRole('button', { name: 'Delete' }).click()
  await expect(question(page)).toContainText(`${deals.length} deals are kept, with no main contact.`)
  await question(page).getByRole('button', { name: 'Delete contact' }).click()
  await expect(page).toHaveURL('/contacts')
  await expect(page.getByRole('status')).toHaveText('59 contacts')
  for (const { id, name } of deals) {
    await open(page, `/deals/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(panel(page, 'Details')).not.toContainText('Main contact')
    await expect(panel(page, 'Details')).toContainText('Upland Water')
  }
})

test('two contacts can share a name and an email', async ({ page }) => {
  await open(page, '/contacts')
  for (let time = 0; time < 2; time += 1) {
    await page.getByRole('button', { name: 'Add contact' }).click()
    await dialog(page).getByLabel('Name').fill('Zoe Marsh')
    await dialog(page).getByLabel('Email').fill('zoe@upland.example')
    await dialog(page).getByRole('button', { name: 'Add contact' }).click()
    await expect(dialog(page)).toBeHidden()
  }
  await search(page).fill('zoe marsh')
  await expect(rows(page)).toHaveCount(2)
})

test('a wrong value shows its problem', async ({ page }) => {
  await open(page, '/contacts')
  await page.getByRole('button', { name: 'Add contact' }).click()
  await dialog(page).getByLabel('Email').fill('not an email')
  await dialog(page).getByRole('button', { name: 'Add contact' }).click()
  await expect(dialog(page).getByLabel('Name')).toHaveAccessibleDescription('Enter a name.')
  await expect(dialog(page).getByLabel('Email')).toHaveAccessibleDescription('Enter an email address, such as name@example.com.')
})

test('a failed save shows a message, and the old value stays', async ({ page, problems }) => {
  problems.expect(CONSOLE.failedSave)
  await open(page, '/contacts/1')
  await page.route('**/api/contacts/1', (route) =>
    route.request().method() === 'PATCH' ? route.fulfill({ status: 500, json: { message: 'Something went wrong on the server.', fields: {} } }) : route.continue(),
  )
  await panel(page, 'Details').getByRole('button', { name: 'Edit' }).click()
  await dialog(page).getByLabel('Name').fill('Changed')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog(page).getByRole('alert')).toHaveText('Not saved. Something went wrong on the server.')
  await expect(dialog(page).getByLabel('Name')).toHaveValue('Changed')
  await dialog(page).getByRole('button', { name: 'Cancel' }).click()
  await question(page).getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marcus Webb')
})
