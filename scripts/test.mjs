// npm test: the type check, pytest, Vitest and Playwright. All four run, even if one fails.
// With --quick, it leaves out Playwright's end-to-end tests.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT, accountableIsRunning, checkVersions, install, main } from './lib.mjs'

const bin = (...parts) => path.join(ROOT, 'node_modules', ...parts)
const tsc = bin('typescript', 'bin', 'tsc')

const END_TO_END = 'End-to-end tests'
const SUITES = [
  ['Type check, frontend', process.execPath, [tsc, '--noEmit', '-p', 'frontend']],
  ['Type check, end-to-end tests', process.execPath, [tsc, '--noEmit', '-p', 'e2e']],
  ['Backend tests', 'uv', ['run', '--no-sync', 'pytest', '-q']],
  ['Frontend tests', process.execPath, [bin('vitest', 'vitest.mjs'), 'run', '--root', 'frontend']],
  [END_TO_END, process.execPath, [bin('@playwright', 'test', 'cli.js'), 'test', '-c', 'e2e']],
]
const quick = process.argv.includes('--quick')
const suites = quick ? SUITES.filter(([name]) => name !== END_TO_END) : SUITES

/** What's in the user's own data, to see that the tests leave it alone (R7). */
const OWN_DATA = path.join(ROOT, 'data', 'accountable.db')
const fingerprint = () => (existsSync(OWN_DATA) ? createHash('sha256').update(readFileSync(OWN_DATA)).digest('hex') : 'none')

await main(async () => {
  checkVersions()
  await install()
  const before = fingerprint()

  // The tests refuse to run on any database that isn't in a folder like this one (R7).
  const folder = mkdtempSync(path.join(os.tmpdir(), 'accountable-tests-'))
  const env = {
    ...process.env,
    ACCOUNTABLE_DB: path.join(folder, 'accountable.db'),
    ACCOUNTABLE_VITE_CACHE: bin('.vite-tests'),
  }
  delete env.npm_config_yes // It would answer the reset command's question in its own tests.

  const failed = []
  for (const [name, command, args] of suites) {
    console.log(`\n${name}`)
    if (spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit' }).status !== 0) failed.push(name)
  }
  rmSync(folder, { recursive: true, force: true })

  // If Accountable is running, the user may have changed the data meanwhile.
  if (fingerprint() !== before && !(await accountableIsRunning())) failed.push('The data in data/ changed while the tests ran')

  console.log(failed.length ? `\nFailed: ${failed.join('; ')}.` : '\nAll tests passed.')
  if (failed.length) process.exitCode = 1
})
