// npm run dev: starts the backend and the frontend together, and stops them together (R1, R3).
import { API_PORT, Problem, WEB_PORT, checkVersions, install, isFree, main, startBackend, startFrontend, stop, waitFor } from './lib.mjs'

const running = []
let closing = false

async function close(exitCode) {
  if (closing) return
  closing = true
  await Promise.all(running.map(({ child }) => stop(child)))
  process.exit(exitCode)
}

function keep(name, child) {
  running.push({ name, child })
  const stopped = () => {
    if (!closing) console.error(`The ${name} stopped, so Accountable is closing.`)
    void close(1)
  }
  child.once('exit', stopped)
  child.once('error', stopped)
  return child
}

await main(async () => {
  checkVersions()
  await install()
  for (const [name, port, setting] of [['backend', API_PORT, 'ACCOUNTABLE_API_PORT'], ['frontend', WEB_PORT, 'ACCOUNTABLE_WEB_PORT']]) {
    if (!(await isFree(port))) {
      throw new Problem(`Port ${port}, which the ${name} needs, is already in use. Close the program using it (perhaps Accountable is already running), or set ${setting} to another port.`)
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => void close(0))

  const backend = keep('backend', startBackend(API_PORT))
  if (!(await waitFor(`http://127.0.0.1:${API_PORT}/api/health`, backend))) return close(1)
  if (closing) return // Stopped meanwhile, so there must be no other half to leave behind.
  const frontend = keep('frontend', startFrontend())
  if (!(await waitFor(`http://127.0.0.1:${WEB_PORT}/`, frontend))) return close(1)
  if (!closing) console.log(`Accountable is running. Open http://localhost:${WEB_PORT} in your browser. Press Ctrl+C here to stop it.`)
})
