import { expect, test } from 'vitest'
import { checkWebsite, websiteLink } from './website'

test.each([
  '',
  'uplandwater.example',
  'https://uplandwater.example',
  'http://uplandwater.example:8080/a',
  'www.uplandwater.example/about?x=1',
])('%s is fine', (website) => {
  expect(checkWebsite(website)).toBe(true)
})

test.each([
  'javascript:alert(1)',
  'javascript://a.example/%0aalert(1)',
  'ftp://a.example',
  'data:text/html,x',
  'mailto:a@b.example',
  'upland',
  'two words.example',
  'https://',
])('%s is refused', (website) => {
  expect(checkWebsite(website)).toBe('Enter a website address, such as example.com.')
})

test('the link always has http or https', () => {
  expect(websiteLink('uplandwater.example')).toBe('https://uplandwater.example')
  expect(websiteLink('HTTP://uplandwater.example')).toBe('HTTP://uplandwater.example')
})
