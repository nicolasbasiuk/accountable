// A PreToolUse hook: stops Claude Code from changing any .env file, which holds this computer's secrets.
// File tools are stopped by the path they write. A shell command is stopped if it names a .env file at all,
// because there are too many ways to write to one; .env.example and other names stay free.
import { realpathSync } from 'node:fs'
import path from 'node:path'

const ENV_FILE = /(^|[\s/\\'"`=<>|;&(])\.env(?=$|[\s'"`<>|;&)])/

function isEnvFile(file) {
  if (!file) return false
  if (path.basename(file) === '.env') return true
  try {
    return path.basename(realpathSync(file)) === '.env' // A link to a .env file.
  } catch {
    return false // It doesn't exist yet.
  }
}

function blockedBecause({ tool_name: tool, tool_input: input = {} }) {
  if (input.command !== undefined) return ENV_FILE.test(input.command) && `This ${tool} command names a .env file.`
  const file = input.file_path ?? input.notebook_path
  return isEnvFile(file) && `${file} is a .env file.`
}

function deny(reason) {
  const output = { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
  console.log(JSON.stringify({ hookSpecificOutput: output }))
}

let stdin = ''
for await (const chunk of process.stdin) stdin += chunk
try {
  const reason = blockedBecause(JSON.parse(stdin))
  if (reason) deny(`${reason} Claude Code may not change .env files. Ask the user to make the change themselves.`)
} catch (error) {
  deny(`The .env guard couldn't read this tool call, so it is stopped to be safe: ${error.message}`)
}
