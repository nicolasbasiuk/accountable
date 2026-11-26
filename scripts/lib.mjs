// What the three commands share. Node built-ins only, because the packages may not be installed yet.
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const WEB_PORT = Number(process.env.ACCOUNTABLE_WEB_PORT ?? 5173)
export const API_PORT = Number(process.env.ACCOUNTABLE_API_PORT ?? 8000)

const WINDOWS = process.platform === 'win32'
const OLDEST_NODE = 24
const STOP_SECONDS = 5

/** A problem the person can understand, shown without a stack trace. */
export class Problem extends Error {}

/** Runs a command's steps, showing a Problem as a plain message. */
export async function main(steps) {
  try {
    await steps()
  } catch (error) {
    if (!(error instanceof Problem)) throw error
    console.error(error.message)
    process.exitCode = 1
  }
}

export function checkVersions() {
  if (Number(process.versions.node.split('.')[0]) < OLDEST_NODE) {
    throw new Problem(`Accountable needs Node.js ${OLDEST_NODE} or later, and this is ${process.versions.node}. Install it from https://nodejs.org, then try again.`)
  }
  if (spawnSync('uv', ['--version'], { stdio: 'ignore' }).error) {
    throw new Problem('Accountable needs uv, and it is not installed. Install it from https://docs.astral.sh/uv, then try again.')
  }
}

// Installing

const LOCK_FILE = path.join(ROOT, 'package-lock.json')
const INSTALLED = path.join(ROOT, 'node_modules', '.accountable')

const lockHash = () => createHash('sha256').update(readFileSync(LOCK_FILE)).digest('hex')
const npmIsCurrent = () => existsSync(INSTALLED) && readFileSync(INSTALLED, 'utf8') === lockHash()
const pythonIsCurrent = () => spawnSync('uv', ['sync', '--frozen', '--check'], { cwd: ROOT, stdio: 'ignore' }).status === 0

export async function accountableIsRunning() {
  for (const port of new Set([8000, API_PORT])) {
    const health = await readHealth(port)
    if (health?.app === 'accountable') return true
  }
  return false
}

async function readHealth(port) {
  try {
    const answer = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) })
    return await answer.json()
  } catch {
    return undefined
  }
}

function installWith(command, args, what) {
  console.log(`Installing the ${what} packages. This needs the internet and can take a minute.`)
  const { status } = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: WINDOWS && command === 'npm' })
  if (status !== 0) throw new Problem(`The ${what} packages couldn't be installed. The reason is above.`)
}

/** Sets up the Git hooks in lefthook.yml. lefthook would do it itself, but --ignore-scripts stops it. */
function installHooks() {
  if (!existsSync(path.join(ROOT, '.git'))) return // A copy without Git has no hooks.
  const lefthook = path.join(ROOT, 'node_modules', 'lefthook', 'bin', 'index.js')
  const { status } = spawnSync(process.execPath, [lefthook, 'install'], { cwd: ROOT, stdio: 'inherit' })
  if (status !== 0) throw new Problem("The Git hooks couldn't be set up. The reason is above.")
}

/** Installs whatever is missing or out of date. */
export async function install() {
  const npm = !npmIsCurrent()
  const python = !pythonIsCurrent()
  if ((npm || python) && (await accountableIsRunning())) {
    throw new Problem('Some packages have to be installed, and Accountable is running. Close it first, then try again.')
  }
  if (npm) {
    installWith('npm', ['ci', '--ignore-scripts', '--no-fund', '--no-audit'], 'JavaScript')
    installHooks()
    writeFileSync(INSTALLED, lockHash())
  }
  if (python) installWith('uv', ['sync', '--frozen'], 'Python')
}

// Ports

function answers(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()
    // An address this computer doesn't have, such as ::1 without IPv6, can't be taken.
    server.once('error', (error) => resolve(error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT'))
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)))
  })
}

/** A port is free only if it's free on both addresses that "localhost" can mean. */
export async function isFree(port) {
  for (const host of ['127.0.0.1', '::1']) {
    if ((await answers(port, host)) || !(await canListen(port, host))) return false
  }
  return true
}

// Programs

/** Starts a program in its own group, so its children can be stopped with it. */
export function start(command, args, options = {}) {
  return spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'], detached: !WINDOWS, ...options })
}

export const startBackend = (port, options) =>
  start('uv', [
    'run', '--no-sync', 'uvicorn', 'accountable.main:app', '--app-dir', 'backend', '--host', '127.0.0.1',
    '--port', String(port), '--log-level', 'warning', '--timeout-graceful-shutdown', '2',
  ], options)

export const startFrontend = (options) =>
  start(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--clearScreen', 'false', '--logLevel', 'warn'], {
    cwd: path.join(ROOT, 'frontend'), ...options,
  })

const hasEnded = (child) => child.exitCode !== null || child.signalCode !== null

function signalGroup(child, signal) {
  try {
    process.kill(-child.pid, signal)
    return true
  } catch {
    return false // Nothing in the group is left.
  }
}

/** Stops a program and its children, and waits until they have gone. */
export async function stop(child) {
  if (!child?.pid) return
  if (WINDOWS) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  signalGroup(child, 'SIGTERM')
  const deadline = Date.now() + STOP_SECONDS * 1000
  while (!hasEnded(child) || signalGroup(child, 0)) {
    if (Date.now() > deadline) return void signalGroup(child, 'SIGKILL')
    await wait(50)
  }
}

/** Waits until an address answers well. Gives up when the program behind it ends. */
export async function waitFor(url, child, seconds = 60) {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    if (child && hasEnded(child)) return false
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return true
    } catch { /* Not ready yet. */ }
    await wait(100)
  }
  return false
}
