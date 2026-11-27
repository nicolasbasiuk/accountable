import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'

// Read from disk: Vitest turns imported CSS into an empty string.
const styles = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8')

// Every other source file. styles.css is the only CSS file.
const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** The colors set in one block of `styles.css`, by name. */
function colorsIn(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value!.trim()]),
  )
}

/** The block that starts with `opening`, up to its closing brace. */
function block(opening: string) {
  const start = styles.indexOf(opening)
  expect(start, opening).toBeGreaterThanOrEqual(0)
  return styles.slice(start, styles.indexOf('}', start))
}

const light = colorsIn(block('@theme'))
const darkValues = colorsIn(block(":root[data-mode='dark']"))
const dark = { ...light, ...darkValues }

// The colors named after a color, which never change. Every other color is named after a role.
const NAMED_AFTER_A_COLOR = [
  'white',
  'black',
  'sea-green',
  'marigold',
  'coral',
  'cerulean',
  'raspberry',
  'midnight',
  'sea-mist',
  'lost',
  'sea-green-hover',
  'raspberry-hover',
]

test('every color named after a role has a dark value, and no color named after a color has one', () => {
  const roles = Object.keys(light).filter((name) => !NAMED_AFTER_A_COLOR.includes(name))
  expect(roles.length).toBeGreaterThan(10)
  expect(Object.keys(darkValues).sort()).toEqual(roles.sort())
})

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((part) => (part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4))
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

function contrast(one: string, other: string) {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a)
  return (lighter! + 0.05) / (darker! + 0.05)
}

// Text, and what it's on (Q3). White on Cerulean and Raspberry is left out, as the spec accepts it.
const TEXT_ON: [string, string[]][] = [
  ['ink', ['page', 'panel', 'raised', 'wash']],
  ['muted', ['page', 'panel', 'raised', 'wash']],
  ['green-text', ['page', 'panel']],
  ['gold-text', ['page', 'panel']],
  ['coral-text', ['page', 'panel']],
  ['midnight', ['sea-green', 'marigold', 'coral']],
  ['on-won', ['won']],
  ['on-lost-block', ['lost-block']],
  // Messages
  ['white', ['midnight']],
  ['sea-green', ['midnight']],
]

const pairs = TEXT_ON.flatMap(([text, backgrounds]) => backgrounds.map((background) => [text, background] as const))

const MODES = { light, dark }

test.each(
  (['light', 'dark'] as const).flatMap((mode) => pairs.map(([text, background]) => [text, background, mode] as const)),
)('%s on %s reaches 4.5 in %s mode', (text, background, mode) => {
  expect(contrast(MODES[mode][text]!, MODES[mode][background]!)).toBeGreaterThanOrEqual(4.5)
})

test('no file but styles.css writes a color out, or uses a dark: class', () => {
  const written = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lch|lab)\(|\bdark:/i
  const found = Object.entries(sources).flatMap(([file, text]) => {
    const match = written.exec(text)
    return match ? [`${file}: ${match[0]}`] : []
  })
  expect(Object.keys(sources).length).toBeGreaterThan(50)
  expect(found).toEqual([])
})
