// npm run seed: resets the data to the sample data (R5, R6).
import { spawnSync } from 'node:child_process'
import { ROOT, checkVersions, install, main } from './lib.mjs'

await main(async () => {
  checkVersions()
  await install()
  // npm keeps "--yes" for itself, unless it comes after "--".
  const yes = process.argv.includes('--yes') || process.env.npm_config_yes === 'true'
  const args = ['run', '--no-sync', 'python', 'backend/seed.py', ...(yes ? ['--yes'] : [])]
  process.exitCode = spawnSync('uv', args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1
})
