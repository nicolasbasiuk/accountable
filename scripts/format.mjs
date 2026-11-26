// npm run format: fixes the formatting that npm run check checks, with Prettier for the frontend and ruff for the backend.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { ROOT, checkVersions, install, main } from './lib.mjs'

const FORMATTERS = [
  [process.execPath, [path.join(ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs'), '--write', 'frontend']],
  ['uv', ['run', '--no-sync', 'ruff', 'format', 'backend']],
]

await main(async () => {
  checkVersions()
  await install()
  for (const [command, args] of FORMATTERS) {
    if (spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status !== 0) process.exitCode = 1
  }
})
