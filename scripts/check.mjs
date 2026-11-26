// npm run check: formatting, lint, the type check, secrets, then npm test. All run, even if one fails.
// npm run check:quick passes --quick, which leaves out the end-to-end tests.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { Problem, ROOT, checkVersions, install, main } from './lib.mjs'

const bin = (...parts) => path.join(ROOT, 'node_modules', ...parts)
const node = process.execPath
const uv = (...args) => ['uv', ['run', '--no-sync', ...args]]
const quick = process.argv.includes('--quick')

const CHECKS = [
  ['Formatting, frontend', node, [bin('prettier', 'bin', 'prettier.cjs'), '--check', 'frontend']],
  ['Lint, frontend', node, [bin('eslint', 'bin', 'eslint.js'), 'frontend']],
  ['Formatting, backend', ...uv('ruff', 'format', '--check', 'backend')],
  ['Lint, backend', ...uv('ruff', 'check', 'backend')],
  ['Type check, frontend', node, [bin('typescript', 'bin', 'tsc'), '--noEmit', '-p', 'frontend']],
  ['Secrets', 'gitleaks', ['dir', '.', '--no-banner', '--redact']],
  [quick ? 'Tests, without the end-to-end tests' : 'Tests', node, ['scripts/test.mjs', ...(quick ? ['--quick'] : [])]],
]

function checkGitleaks() {
  if (spawnSync('gitleaks', ['version'], { stdio: 'ignore' }).error) {
    throw new Problem(
      'npm run check needs gitleaks, and it is not installed. Install it with "brew install gitleaks" on a Mac or "winget install -e --id Gitleaks.Gitleaks" on Windows, then try again.',
    )
  }
}

await main(async () => {
  checkVersions()
  checkGitleaks()
  await install()

  const failed = []
  for (const [name, command, args] of CHECKS) {
    console.log(`\n${name}`)
    if (spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status !== 0) failed.push(name)
  }

  console.log(failed.length ? `\nFailed: ${failed.join('; ')}.` : '\nAll checks passed.')
  if (failed.length) process.exitCode = 1
})
