import type { Locator, Page } from '@playwright/test'
import { dialog, expect, inDarkMode, modeSwitch, open, panel, question, shownMode, test, WEB_PORT } from './support'

const SECTIONS = ['/', '/organizations', '/contacts', '/deals', '/pipeline']
const SCREENS = ['/', '/organizations', '/organizations/1', '/contacts', '/contacts/1', '/deals', '/deals/1', '/pipeline', '/nowhere']

const background = (part: Locator) => part.evaluate((element) => getComputedStyle(element).backgroundColor)

/** On the pipeline: the page, its text, the first card and Won's block. */
async function pipelineColors(page: Page) {
  return {
    page: await background(page.locator('body')),
    text: await page.locator('body').evaluate((body) => getComputedStyle(body).color),
    card: await background(page.getByRole('article').first()),
    won: await background(page.getByRole('region', { name: 'Won', exact: true }).locator(':scope > div').first()),
    scheme: await page.locator('html').evaluate((html) => getComputedStyle(html).colorScheme),
  }
}

const LIGHT = { page: 'rgb(240, 244, 245)', text: 'rgb(7, 59, 76)', card: 'rgb(255, 255, 255)', won: 'rgb(7, 59, 76)', scheme: 'normal' }
const DARK = { page: 'rgb(4, 35, 46)', text: 'rgb(205, 216, 219)', card: 'rgb(0, 0, 0)', won: 'rgb(205, 216, 219)', scheme: 'dark' }

/** Opens a screen and waits for its content. */
async function openFully(page: Page, address: string) {
  await open(page, address)
  await expect(page.locator('tbody tr, article, li, main a').first()).toBeVisible()
}

/** What shows a white surface: a background, or an SVG shape's fill or stroke. Icons and text follow their text color. */
const whiteParts = (page: Page) =>
  page.evaluate(() => {
    const white = 'rgb(255, 255, 255)'
    return [...document.querySelectorAll('body *')]
      .filter((part) => {
        const style = getComputedStyle(part)
        if (style.visibility === 'hidden' || !part.getClientRects().length) return false
        const shape = part.matches('rect, circle, ellipse, path, line, polyline, polygon') && !part.closest('svg.lucide')
        return style.backgroundColor === white || (shape && (style.fill === white || style.stroke === white))
      })
      .map((part) => part.outerHTML.slice(0, 150))
  })

test('a fresh browser starts light, with the Dark mode switch off, on every section', async ({ page }) => {
  for (const address of SECTIONS) {
    await open(page, address)
    await expect(modeSwitch(page), address).not.toBeChecked()
    expect(await shownMode(page), address).toBe('light')
  }
})

test('turning it on darkens everything at once, and it stays dark after a reload and on another section', async ({ page }) => {
  await openFully(page, '/pipeline')
  expect(await pipelineColors(page)).toEqual(LIGHT)
  await modeSwitch(page).click()
  expect(await pipelineColors(page)).toEqual(DARK)

  await page.reload()
  await openFully(page, '/pipeline')
  expect(await pipelineColors(page)).toEqual(DARK)
  await openFully(page, '/')
  expect(await background(panel(page, 'Figures'))).toBe('rgb(0, 0, 0)')

  await modeSwitch(page).click()
  expect(await background(panel(page, 'Figures'))).toBe('rgb(255, 255, 255)')
  await openFully(page, '/pipeline')
  await page.reload()
  await openFully(page, '/pipeline')
  expect(await pipelineColors(page)).toEqual(LIGHT)
})

test('the keyboard reaches the switch with its focus visible, and Space turns it on and off', async ({ page }) => {
  await open(page, '/')
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Pipeline' }).focus()
  await page.keyboard.press('Tab')
  await expect(modeSwitch(page)).toBeFocused()
  expect(await modeSwitch(page).evaluate((control) => getComputedStyle(control).outlineStyle)).not.toBe('none')

  await page.keyboard.press('Space')
  await expect(modeSwitch(page)).toBeChecked()
  expect(await shownMode(page)).toBe('dark')
  await page.keyboard.press('Space')
  await expect(modeSwitch(page)).not.toBeChecked()
  expect(await shownMode(page)).toBe('light')
})

test('a second tab switches when the first does', async ({ page, context }) => {
  const other = await context.newPage()
  await open(page, '/')
  await open(other, '/deals')
  await modeSwitch(page).click()
  await expect(modeSwitch(other)).toBeChecked()
  expect(await shownMode(other)).toBe('dark')
  await modeSwitch(page).click()
  await expect(modeSwitch(other)).not.toBeChecked()
  expect(await shownMode(other)).toBe('light')
})

test('with dark mode chosen, the page is already dark when its body first appears', async ({ page }) => {
  await inDarkMode(page)
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return
      document.documentElement.dataset.modeAtBody = document.documentElement.dataset.mode ?? 'light'
      observer.disconnect()
    }).observe(document, { childList: true, subtree: true })
  })
  await open(page, '/')
  expect(await page.evaluate(() => document.documentElement.dataset.modeAtBody)).toBe('dark')
})

test('a new browser starts light, whatever another one chose', async ({ page, browser }) => {
  await open(page, '/')
  await modeSwitch(page).click()
  expect(await shownMode(page)).toBe('dark')

  const another = await browser.newContext({ baseURL: `http://localhost:${WEB_PORT}` })
  const fresh = await another.newPage()
  await open(fresh, '/')
  await expect(modeSwitch(fresh)).not.toBeChecked()
  expect(await shownMode(fresh)).toBe('light')
  await another.close()
})

test('in dark mode, nothing shows a white surface: screens, forms, menus, pickers, tooltips and messages', async ({ page }) => {
  await inDarkMode(page)
  for (const address of SCREENS) {
    await openFully(page, address)
    expect(await whiteParts(page), address).toEqual([])
  }

  const tooltip = page.getByText(/^\$[\d,]+ open value$/)
  await openFully(page, '/')
  await panel(page, 'Open deals by stage').getByRole('img', { name: /^Proposal/ }).hover()
  await expect(tooltip).toBeVisible()
  expect(await whiteParts(page), 'chart tooltip').toEqual([])
  const chart = panel(page, 'Revenue won by month').locator('svg.recharts-surface').first()
  await chart.focus()
  await page.keyboard.press('ArrowRight')
  await expect(panel(page, 'Revenue won by month').locator('.recharts-tooltip-wrapper')).toBeVisible()
  expect(await whiteParts(page), 'line chart tooltip').toEqual([])

  await openFully(page, '/deals')
  await page.getByRole('button', { name: 'Add deal' }).click()
  await dialog(page).getByRole('button', { name: 'Add deal' }).click()
  await expect(dialog(page).getByText(/^Enter a/).first()).toBeVisible()
  expect(await whiteParts(page), 'form with problems').toEqual([])
  await dialog(page).getByRole('button', { name: 'Show every contact' }).click()
  await expect(page.getByRole('option').first()).toBeVisible()
  expect(await whiteParts(page), 'contact picker').toEqual([])
  await page.keyboard.press('Escape')
  await dialog(page).getByRole('combobox', { name: 'Stage' }).click()
  await expect(page.getByRole('option').first()).toBeVisible()
  expect(await whiteParts(page), 'stage menu').toEqual([])
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toBeHidden()

  await page.getByRole('button', { name: /^Delete/ }).first().click()
  await expect(question(page).getByText("This can't be undone.")).toBeVisible()
  expect(await whiteParts(page), 'delete question').toEqual([])
  await question(page).getByRole('button', { name: 'Delete deal' }).click()
  await expect(page.getByText(/^Deleted/)).toBeVisible()
  expect(await whiteParts(page), 'message').toEqual([])
})
