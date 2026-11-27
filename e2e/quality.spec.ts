import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { API_PORT, api, dialog, expect, inDarkMode, open, panel, question, rows, search, test } from './support'

const SCREENS = ['/', '/organizations', '/organizations/1', '/contacts', '/contacts/1', '/deals', '/deals/1', '/pipeline', '/nowhere']

/** Opens a screen and waits for its content, not only its heading. */
async function openFully(page: Page, address: string) {
  await open(page, address)
  await expect(page.locator('tbody tr, article, li, main a').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

/** What sticks out of a table, a panel, a card or a list. */
const tooWide = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('section, td, th, article, dd, li')]
      .filter((part) => part.scrollWidth > part.clientWidth + 1 && getComputedStyle(part).overflowX === 'visible' && getComputedStyle(part).display !== 'inline')
      .map((part) => `${part.tagName} ${part.textContent!.slice(0, 40)}`),
  )

test.describe('sizes', () => {
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]] as const) {
    test(`no screen scrolls sideways at ${width} by ${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      for (const address of SCREENS) {
        await openFully(page, address)
        expect(await page.evaluate(() => document.documentElement.scrollWidth), address).toBe(width)
        expect(await tooWide(page), address).toEqual([])
      }
    })
  }

  test('very long names and very large values stay inside', async ({ page }) => {
    const add = async (area: string, data: object) =>
      ((await (await page.request.post(`http://127.0.0.1:${API_PORT}/api/${area}`, { data })).json()) as { id: number }).id
    const long = 'Averyveryverylongnamewithoutanyspacesinit'.repeat(4)
    const organization_id = await add('organizations', { name: long, website: `https://${'a'.repeat(60)}.example/${'b'.repeat(80)}`, industry: long, notes: long })
    const contact_id = await add('contacts', { name: long, email: `${'x'.repeat(50)}@${'y'.repeat(50)}.example`, phone: '0'.repeat(40), job_title: long, organization_id })
    const deal_id = await add('deals', { name: long, value: 999_999_999_999, close_date: '2026-11-01', stage: 'negotiation', organization_id, contact_id })
    await add('activities', { type: 'note', description: long, deal_id, follow_up_on: '2026-11-20' })

    await page.setViewportSize({ width: 1280, height: 720 })
    const records = [`/organizations/${organization_id}`, `/contacts/${contact_id}`, `/deals/${deal_id}`]
    for (const address of ['/', '/organizations?search=avery', '/contacts?search=avery', '/deals?search=avery', '/pipeline', ...records]) {
      await openFully(page, address)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), address).toBe(1280)
      expect(await tooWide(page), address).toEqual([])
    }
    await open(page, `/deals/${deal_id}`)
    await panel(page, 'Details').getByRole('button', { name: 'Delete' }).click()
    await question(page).getByRole('button', { name: 'Delete deal' }).click()
    await expect(page.getByText(/^Deleted Avery/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280)
  })

  test('at 1440 by 900 the figures, both charts and the top of the funnel show', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openFully(page, '/')
    const bottom = async (name: string) => {
      const box = (await panel(page, name).boundingBox())!
      return box.y + box.height
    }
    for (const name of ['Figures', 'Revenue won by month', 'Deals won by month']) expect(await bottom(name), name).toBeLessThan(900)
    const ribbon = (await page.getByRole('group', { name: 'Funnel of the value that reached each stage' }).boundingBox())!
    expect(ribbon.y).toBeLessThan(800)
  })

  test('a table scrolls under its heading row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await openFully(page, '/deals')
    const heading = page.getByRole('columnheader', { name: 'Name' })
    const before = (await heading.boundingBox())!.y
    await rows(page).last().scrollIntoViewIfNeeded()
    expect((await heading.boundingBox())!.y).toBe(before)
    await expect(rows(page).last()).toBeInViewport()
    await expect(search(page)).toBeInViewport()
  })
})

// The brand's white on Cerulean and Raspberry, which the spec accepts (Q3). Nothing else is left out.
const ACCEPTED = ['#118ab2', '#ef476f']

async function checkAccessibility(page: Page, what: string, without: string[] = []) {
  // Colors are read once nothing is fading in.
  await page.waitForFunction(() => document.getAnimations().every(({ playState }) => playState !== 'running'))
  const { violations } = await new AxeBuilder({ page }).disableRules(without).analyze()
  const left = violations
    .map(({ id, nodes }) => ({
      id,
      nodes: nodes
        .filter(({ any }) => !(id === 'color-contrast' && any[0]?.data?.fgColor === '#ffffff' && ACCEPTED.includes(any[0]?.data?.bgColor)))
        .map(({ html, failureSummary }) => `${html.slice(0, 200)} ${failureSummary}`),
    }))
    .filter(({ nodes }) => nodes.length)
  expect(left, what).toEqual([])
}

// In both modes, as dark mode's text meets the same contrast rules (Q3).
for (const mode of ['light', 'dark'] as const) {
  test.describe(`the accessibility check, in ${mode} mode`, () => {
    test.beforeEach(async ({ page }) => {
      if (mode === 'dark') await inDarkMode(page)
    })

    for (const address of SCREENS) {
      test(`of ${address}`, async ({ page }) => {
        await openFully(page, address)
        await checkAccessibility(page, address)
      })
    }

    test("of the charts' tables", async ({ page }) => {
      await openFully(page, '/')
      const buttons = page.getByRole('button', { name: /^Show table/ })
      for (let left = 4; left > 0; left -= 1) {
        await expect(buttons).toHaveCount(left)
        await buttons.first().click()
      }
      await checkAccessibility(page, 'tables')
    })

    for (const [name, address, button] of [
      ['organization', '/organizations', 'Add organization'],
      ['contact', '/contacts', 'Add contact'],
      ['deal', '/deals', 'Add deal'],
      ['activity', '/deals/1', 'Log activity'],
    ] as const) {
      test(`of the ${name} form, with problems`, async ({ page }) => {
        await openFully(page, address)
        await page.getByRole('button', { name: button }).click()
        await expect(dialog(page)).toBeVisible()
        await checkAccessibility(page, 'form')
        if (name === 'activity') await dialog(page).getByLabel('Happened').fill('')
        await dialog(page).getByRole('button', { name: button }).click()
        await expect(dialog(page).getByText(/^Enter a/).first()).toBeVisible()
        await checkAccessibility(page, 'form with problems')
      })
    }

    test('of the pickers, the questions and a message', async ({ page }) => {
      await openFully(page, '/deals')
      await page.getByRole('button', { name: 'Add deal' }).click()
      await dialog(page).getByRole('button', { name: 'Show every contact' }).click()
      await expect(page.getByRole('option').first()).toBeVisible()
      // A list that opens over the page isn't in one of its landmarks, and needn't be.
      await checkAccessibility(page, 'contact picker', ['region'])
      await page.keyboard.press('Escape')
      await dialog(page).getByRole('combobox', { name: 'Stage' }).click()
      await expect(page.getByRole('option').first()).toBeVisible()
      await checkAccessibility(page, 'stage list', ['region'])
      await page.keyboard.press('Escape')
      await dialog(page).getByLabel('Name').fill('Zebra system')
      await page.keyboard.press('Escape')
      await expect(question(page)).toBeVisible()
      await checkAccessibility(page, 'discard question')
      await question(page).getByRole('button', { name: 'Discard changes' }).click()
      await expect(dialog(page)).toBeHidden()

      await page.getByRole('button', { name: /^Delete/ }).first().click()
      await expect(question(page).getByText("This can't be undone.")).toBeVisible()
      await checkAccessibility(page, 'delete question')
      await question(page).getByRole('button', { name: 'Delete deal' }).click()
      await expect(page.getByText(/^Deleted/)).toBeVisible()
      await checkAccessibility(page, 'message')
    })

    test('of a held card', async ({ page }) => {
      await openFully(page, '/pipeline')
      await page.getByRole('article').getByRole('link').first().focus()
      await page.keyboard.press('Space')
      await expect(page.getByRole('article').first()).toHaveCSS('position', 'fixed')
      await checkAccessibility(page, 'held card')
    })
  })
}

test.describe('with the keyboard only', () => {
  /** Presses Tab until a control has the focus, checking that each stop can be seen. */
  async function tabTo(page: Page, name: string | RegExp, role: 'button' | 'link' | 'textbox' | 'combobox' | 'checkbox' | 'radio' | 'searchbox', key = 'Tab') {
    const target = page.getByRole(role, { name }).first()
    for (let stop = 0; stop < 150; stop += 1) {
      const seen = await page.evaluate(() => {
        const focused = document.activeElement
        if (!focused || focused === document.body || focused.hasAttribute('data-base-ui-focus-guard')) return true
        const around = [focused, focused.parentElement, focused.closest('article, label')]
        return around.some((part) => part && getComputedStyle(part).outlineStyle !== 'none' && parseFloat(getComputedStyle(part).outlineWidth) >= 1)
      })
      expect(seen, await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200))).toBe(true)
      if (await target.evaluate((control) => control === document.activeElement, undefined, { timeout: 2000 }).catch(() => false)) return
      await page.keyboard.press(key)
    }
    throw new Error(`${key} never reached ${String(name)}`)
  }

  test('add, edit and delete a deal', async ({ page }) => {
    await open(page, '/')
    await tabTo(page, 'Deals', 'link')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toHaveText('96 deals')
    await tabTo(page, 'Add deal', 'button')
    await page.keyboard.press('Enter')
    await expect(dialog(page).getByLabel('Name')).toBeFocused()
    await page.keyboard.type('Zebra system')
    await tabTo(page, /^Organization/, 'combobox')
    await page.keyboard.type('upland')
    await expect(page.getByRole('option', { name: 'Upland Water' })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(dialog(page).getByRole('combobox', { name: 'Organization' })).toHaveValue('Upland Water')
    await tabTo(page, 'Stage', 'combobox')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option', { name: 'Won' })).toBeVisible()
    await page.keyboard.type('Won')
    await page.keyboard.press('Enter')
    await expect(dialog(page).getByRole('combobox', { name: 'Stage' })).toContainText('Won')
    await tabTo(page, 'Value', 'textbox')
    await page.keyboard.type('12500')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toHaveText('97 deals')

    // The focus is back on the Add button, which comes after the search.
    await tabTo(page, 'Search deals', 'searchbox', 'Shift+Tab')
    await page.keyboard.type('zebra')
    await expect(rows(page)).toHaveCount(1)
    await tabTo(page, 'Edit Zebra system', 'button')
    await page.keyboard.press('Space')
    await expect(dialog(page).getByLabel('Name')).toBeFocused()
    await page.keyboard.press('End')
    await page.keyboard.type(' two')
    await page.keyboard.press('Enter')
    await expect(rows(page)).toContainText('Zebra system two')

    await tabTo(page, 'Delete Zebra system two', 'button')
    await page.keyboard.press('Enter')
    await expect(question(page).getByText("This can't be undone.")).toBeVisible()
    await tabTo(page, 'Delete deal', 'button')
    await page.keyboard.press('Enter')
    await expect(page.getByText('No deals match.')).toBeVisible()
  })

  test('log an activity and mark its follow-up done', async ({ page }) => {
    await open(page, '/deals/1')
    await tabTo(page, 'Log activity', 'button')
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await tabTo(page, 'Note', 'radio')
    await page.keyboard.press('ArrowRight')
    await expect(dialog(page).getByRole('radio', { name: 'Call' })).toBeChecked()
    await tabTo(page, 'Description', 'textbox')
    await page.keyboard.type('Called by keyboard')
    for (let press = 0; press < 12; press += 1) {
      if (await dialog(page).getByLabel('Follow up on').evaluate((field) => field === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await page.keyboard.type('11112026') // The same, whichever of day and month comes first.
    await page.keyboard.press('Enter')
    const item = panel(page, 'Timeline').getByRole('listitem').first()
    await expect(item).toContainText('Called by keyboard')
    await expect(item).toContainText('Nov 11, 2026')
    await tabTo(page, 'Done: Called by keyboard', 'checkbox')
    await page.keyboard.press('Space')
    await expect(item.getByRole('checkbox')).toBeChecked()
  })

  test('closing a form gives the focus back', async ({ page }) => {
    await open(page, '/deals')
    await page.getByRole('button', { name: 'Add deal' }).focus()
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByRole('button', { name: 'Add deal' })).toBeFocused()
  })

  test('sort, filter and open a record', async ({ page }) => {
    await open(page, '/contacts')
    await tabTo(page, /^Customer/, 'button')
    await page.keyboard.press('Space')
    await expect(rows(page)).toHaveCount(20)
    await tabTo(page, 'Organization', 'button')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('columnheader', { name: 'Organization' })).toHaveAttribute('aria-sort', 'ascending')
    const name = (await rows(page).first().getByRole('link').first().innerText()).trim()
    await tabTo(page, name, 'link')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  })
})

test('with reduced motion, nothing animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const longest = () =>
    page.evaluate(() =>
      Math.max(0, ...document.getAnimations().map((animation) => Number(animation.effect?.getComputedTiming().duration ?? 0))),
    )
  const slow = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((part) => [getComputedStyle(part).transitionDuration, getComputedStyle(part).animationDuration].some((text) => text.split(',').some((time) => parseFloat(time) > 0.001)))
        .map((part) => part.outerHTML.slice(0, 120)),
    )
  for (const address of ['/', '/deals', '/pipeline']) {
    await openFully(page, address)
    expect(await slow(), address).toEqual([])
    await page.getByRole('button', { name: 'Add deal' }).first().click()
    await expect(dialog(page)).toBeVisible()
    expect(await longest()).toBeLessThanOrEqual(1)
    expect(await slow(), address).toEqual([])
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
  }
  // A card can still be dropped, with nothing to wait for.
  const first = page.getByRole('article').first()
  await first.getByRole('link').focus()
  await page.keyboard.press('Space')
  await expect(first).toHaveCSS('position', 'fixed')
  expect(await slow()).toEqual([])
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await expect(page.locator('article').filter({ hasText: 'Lost' })).toHaveCount(0)
  await expect(page.getByText(/^Moved .* to Qualified\.$/)).toBeVisible()
})

test('empty states, after deleting everything', async ({ page }) => {
  for (const area of ['deals', 'contacts', 'organizations']) {
    for (const { id } of await api<{ id: number }[]>(page, `/${area}`)) {
      expect((await page.request.delete(`http://127.0.0.1:${API_PORT}/api/${area}/${id}`)).ok()).toBe(true)
    }
  }
  await open(page, '/')
  await expect(page.getByText('Nothing is overdue or late.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Figures' })).toContainText('Revenue won this month$00 deals')
  await expect(panel(page, 'Follow-ups')).toContainText('Nothing to follow up in the next 14 days.')
  await expect(panel(page, 'Recent activity')).toContainText('What happens with your contacts and deals goes here.')
  await expect(panel(page, 'How far deals get').getByRole('img', { name: 'New: $0, 0 deals' })).toBeVisible()
  await checkAccessibility(page, 'empty dashboard')

  for (const [address, text, button] of [
    ['/organizations', 'The companies you do business with go here.', 'Add organization'],
    ['/contacts', 'The people you deal with go here, including leads and customers.', 'Add contact'],
    ['/deals', 'The sales you hope to make go here.', 'Add deal'],
  ] as const) {
    await open(page, address)
    const main = page.getByRole('main')
    await expect(main.getByText(text)).toBeVisible()
    await checkAccessibility(page, address)
    await main.getByRole('button', { name: button }).last().click()
    await dialog(page).getByLabel('Name').fill('The first one')
    if (address === '/deals') {
      await dialog(page).getByLabel('Value').fill('1000')
      await dialog(page).getByLabel('Close date').fill('2027-02-01')
    }
    await dialog(page).getByRole('button', { name: button }).click()
    await expect(rows(page)).toHaveCount(1)
  }

  await open(page, '/pipeline')
  await expect(page.getByText('No deals in Qualified.')).toBeVisible()
  await expect(page.getByText('No deals won in the last 90 days.')).toBeVisible()
  await expect(page.getByText('No deals lost in the last 90 days.')).toBeVisible()

  const [{ id }] = (await api<{ id: number }[]>(page, '/contacts')) as [{ id: number }]
  await open(page, `/contacts/${id}`)
  await expect(panel(page, 'Deals')).toContainText('The sales you hope to make go here.')
  await expect(panel(page, 'Timeline')).toContainText('Notes, calls, emails and changes of stage go here.')
  const [organization] = (await api<{ id: number }[]>(page, '/organizations')) as [{ id: number }]
  await open(page, `/organizations/${organization.id}`)
  await expect(panel(page, 'Contacts')).toContainText('The people who work here go here.')
})
