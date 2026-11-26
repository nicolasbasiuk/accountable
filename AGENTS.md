# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/spec.md`: what the product is and how it behaves today, as a whole. Read it first
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far
- `docs/STANDARDS.md`: the coding guidelines. Follow them in every change
- `docs/changes/<branch name>/`: one folder for each change, named after its branch, with its `intent.md` and `plan.md`. Read only the current change's folder, the one for the branch you're on. The others are history

A change updates `docs/spec.md` on its branch, so it still describes the whole product

Update `docs/STATUS.md` when you finish a piece of work

## Testing

`npm test` runs the type check and all the unit and end-to-end tests, and fails if any fail. It takes about four minutes.

Run it before you finish a piece of work. If it fails, find the root cause and fix it until it passes. Never skip, delete or weaken a test to make it pass.
