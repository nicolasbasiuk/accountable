import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isFree, ROOT, stop, waitFor } from '../scripts/lib.mjs'
import { API_PORT, APP_ENV, DATABASE, expect, seed, test, TODAY } from './support'

const WINDOWS = process.platform === 'win32'

// Whatever a test started is stopped after it, also if it failed.
const started: ChildProcess[] = []
test.afterEach(async () => {
  for (const child of started.splice(0)) await stop(child)
})

/** npm run dev, on ports and data of its own. */
function dev(web: number, apiPort: number, folder: string, more: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev.mjs')], {
    env: {
      ...process.env,
      ACCOUNTABLE_DB: path.join(path.dirname(DATABASE), folder, 'accountable.db'),
      ACCOUNTABLE_TODAY: TODAY,
      ACCOUNTABLE_WEB_PORT: String(web),
      ACCOUNTABLE_API_PORT: String(apiPort),
      ACCOUNTABLE_VITE_CACHE: path.join(ROOT, 'node_modules', '.vite-tests-commands'),
      ...more,
    },
    detached: !WINDOWS,
  })
  started.push(child)
  const run = { child, output: '', ended: new Promise<number | null>((resolve) => child.once('exit', resolve)) }
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (text) => (run.output += text))
  return run
}

/** Its children, by what they run. */
function childOf(parent: ChildProcess, what: string): number {
  const pids = spawnSync('pgrep', ['-P', String(parent.pid)], { encoding: 'utf8' }).stdout.trim().split('\n')
  const found = pids.find((pid) => spawnSync('ps', ['-o', 'command=', '-p', pid], { encoding: 'utf8' }).stdout.includes(what))
  expect(found, `a child that runs ${what}`).toBeDefined()
  return Number(found)
}

async function listen(port: number, host: string) {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(port, host, resolve))
  return server
}

test('a taken port is named, and nothing keeps running', async () => {
  for (const [port, host, name] of [[5275, '127.0.0.1', 'frontend'], [5275, '::1', 'frontend'], [8102, '127.0.0.1', 'backend'], [8102, '::1', 'backend']] as const) {
    const server = await listen(port, host)
    const run = dev(5275, 8102, 'ports')
    expect(await run.ended).toBe(1)
    expect(run.output).toContain(`Port ${port}, which the ${name} needs, is already in use.`)
    expect(server.listening).toBe(true) // Other programs are never closed.
    await new Promise((resolve) => server.close(resolve))
    expect(await isFree(5275)).toBe(true)
    expect(await isFree(8102)).toBe(true)
  }
})

test('when one half stops, the command says which and stops the other', async () => {
  test.skip(WINDOWS, 'Finds the halves with pgrep.')
  for (const [name, what] of [['backend', 'uvicorn'], ['frontend', 'vite']] as const) {
    const run = dev(5276, 8103, 'halves')
    await expect.poll(() => run.output, { timeout: 30_000 }).toContain('Open http://localhost:5276 in your browser.')
    process.kill(childOf(run.child, what), 'SIGKILL')
    expect(await run.ended).toBe(1)
    expect(run.output).toContain(`The ${name} stopped, so Accountable is closing.`)
    await expect.poll(() => isFree(5276)).toBe(true)
    await expect.poll(() => isFree(8103)).toBe(true)
  }
})

test('Ctrl+C stops both', async () => {
  test.skip(WINDOWS, 'Signals are different there.')
  const run = dev(5276, 8103, 'halves')
  await expect.poll(() => run.output, { timeout: 30_000 }).toContain('Open http://localhost:5276 in your browser.')
  run.child.kill('SIGINT')
  expect(await run.ended).toBe(0)
  expect(run.output).not.toContain('stopped, so Accountable is closing')
  expect(await isFree(5276)).toBe(true)
  expect(await isFree(8103)).toBe(true)
})

test('stopped while it is still starting, it leaves nothing running', async () => {
  test.skip(WINDOWS, 'The stand-in for uv is a shell script.')
  // A backend that's ready only after the stop was asked for, and takes its time to end.
  const folder = mkdtempSync(path.join(path.dirname(DATABASE), 'stand-in-'))
  const uv = spawnSync('which', ['uv'], { encoding: 'utf8' }).stdout.trim()
  writeFileSync(
    path.join(folder, 'backend.mjs'),
    `import http from 'node:http'
     process.on('SIGTERM', () => {})
     setTimeout(() => http.createServer((_, answer) => answer.end('{}')).listen(8103, '127.0.0.1'), 1500)`,
  )
  writeFileSync(
    path.join(folder, 'uv'),
    `#!/bin/sh\nif [ "$1" = run ]; then exec "${process.execPath}" "${folder}/backend.mjs"; fi\nexec "${uv}" "$@"\n`,
    { mode: 0o755 },
  )
  const run = dev(5276, 8103, 'halves', { PATH: `${folder}${path.delimiter}${process.env.PATH}` })
  await new Promise((resolve) => setTimeout(resolve, 800))
  run.child.kill('SIGTERM')
  await run.ended
  expect(await waitFor('http://127.0.0.1:5276/', undefined, 2), 'a frontend left behind').toBe(false)
  expect(await isFree(8103)).toBe(true)
})

test('a half that never gets ready is named, and nothing keeps running', async () => {
  test.skip(WINDOWS, 'The stand-in for uv is a shell script.')
  const folder = mkdtempSync(path.join(path.dirname(DATABASE), 'never-ready-'))
  const uv = spawnSync('which', ['uv'], { encoding: 'utf8' }).stdout.trim()
  writeFileSync(path.join(folder, 'uv'), `#!/bin/sh\nif [ "$1" = run ]; then exec sleep 300; fi\nexec "${uv}" "$@"\n`, { mode: 0o755 })
  // A clock that's 60 times as fast, so the minute it waits takes a second.
  writeFileSync(path.join(folder, 'clock.mjs'), 'const now = Date.now; const start = now(); Date.now = () => start + (now() - start) * 60')
  const run = dev(5276, 8103, 'halves', {
    PATH: `${folder}${path.delimiter}${process.env.PATH}`,
    NODE_OPTIONS: `--import=${pathToFileURL(path.join(folder, 'clock.mjs'))}`,
  })
  expect(await run.ended).toBe(1)
  expect(run.output).toContain("The backend wasn't ready within a minute, so Accountable is closing.")
  expect(await isFree(8103)).toBe(true)
})

test('data changed before a restart is there after it', async () => {
  const address = 'http://127.0.0.1:8104/api/organizations'
  const names = async () => ((await (await fetch(address)).json()) as { name: string }[]).map(({ name }) => name)
  const folder = `restart-${Date.now()}`
  for (const start of [1, 2]) {
    const run = dev(5277, 8104, folder)
    expect(await waitFor('http://127.0.0.1:8104/api/health', run.child), run.output).toBe(true)
    if (start === 1) {
      expect(await names()).toHaveLength(24)
      const headers = { 'Content-Type': 'application/json' }
      await fetch(address, { method: 'POST', headers, body: JSON.stringify({ name: 'Added before the restart' }) })
      await fetch(`${address}/1`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Renamed before the restart' }) })
      await fetch(`${address}/2`, { method: 'DELETE' })
    } else {
      expect(await names()).toHaveLength(24)
      expect(await names()).toEqual(expect.arrayContaining(['Added before the restart', 'Renamed before the restart']))
      expect(await names()).not.toContain('Juniper Retail Group')
    }
    await stop(run.child)
    await run.ended
  }
})

test.describe('npm run seed', () => {
  const amount = async () => ((await (await fetch(`http://127.0.0.1:${API_PORT}/api/organizations`)).json()) as unknown[]).length
  const copies = () => readdirSync(path.join(path.dirname(DATABASE), 'backups')).length
  const npm = (...args: string[]) =>
    spawnSync('npm', ['run', 'seed', ...args], { cwd: ROOT, env: { ...process.env, ...APP_ENV }, encoding: 'utf8', shell: WINDOWS, stdio: ['ignore', 'pipe', 'pipe'] })

  test.beforeEach(async () => {
    await fetch(`http://127.0.0.1:${API_PORT}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Added by hand' }),
    })
    expect(await amount()).toBe(25)
  })

  test('with the flag after --, while the app runs', async () => {
    const before = copies()
    const { status, stdout } = npm('--', '--yes')
    expect(status).toBe(0)
    expect(stdout).toMatch(/Saved a copy of the data: .*accountable-2026-11-24-\d{6}(-\d+)?\.db/)
    expect(await amount()).toBe(24)
    expect(copies()).toBe(before + 1)
  })

  test("with the flag as npm's own", async () => {
    expect(npm('--yes').status).toBe(0)
    expect(await amount()).toBe(24)
  })

  test('without a terminal it fails and changes nothing', async () => {
    const before = copies()
    const { status, stderr } = npm()
    expect(status).not.toBe(0)
    expect(stderr).toContain("There's no one to ask, so nothing was changed.")
    expect(await amount()).toBe(25)
    expect(copies()).toBe(before + 1)
  })
})

test.describe("the user's own data", () => {
  const own = path.join(ROOT, 'data', 'accountable.db')
  const fingerprint = () => (existsSync(own) ? createHash('sha256').update(readFileSync(own)).digest('hex') : 'none')

  test('is the same after a reset and a change', async () => {
    const before = fingerprint()
    expect(seed('--yes').status).toBe(0)
    await fetch(`http://127.0.0.1:${API_PORT}/api/organizations/1`, { method: 'DELETE' })
    expect(fingerprint()).toBe(before)
    expect(DATABASE).not.toBe(own)
  })

  for (const [what, database] of [['none', ''], ["the user's", own], ['one elsewhere', path.join(ROOT, 'elsewhere', 'accountable.db')]] as const) {
    test(`the tests refuse to start with ${what} as their database`, () => {
      const env = { ...process.env, ACCOUNTABLE_DB: database }
      const playwright = spawnSync(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '-c', 'e2e', '--list'], { cwd: ROOT, env, encoding: 'utf8' })
      expect(playwright.status).not.toBe(0)
      expect(playwright.stdout + playwright.stderr).toContain('The tests need a database of their own.')
      const pytest = spawnSync('uv', ['run', '--no-sync', 'pytest', '--collect-only', '-q'], { cwd: ROOT, env, encoding: 'utf8' })
      expect(pytest.status).not.toBe(0)
      expect(pytest.stdout + pytest.stderr).toContain('The tests need a database of their own.')
    })
  }
})
