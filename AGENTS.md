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

At Deploy, after the review fixes and before the merge, follow `docs/IMPROVE.md` to improve the harness

## Checks and tests

`npm run check` runs Prettier and ESLint on the frontend, ruff format and ruff check on the backend, tsc, gitleaks across the repo, then `npm test`, and fails if any fail. It takes about four minutes. `npm test` runs the type check and all the unit and end-to-end tests. `npm run check:quick` is `npm run check` without the end-to-end tests. `npm run format` fixes the formatting.

Run `npm run check` before you finish a piece of work. If it fails, find the root cause and fix it until it passes. Never skip, delete or weaken a test or a rule to make it pass.

A pre-commit hook in `lefthook.yml` formats the staged files, then runs lint, types and gitleaks. If it fails, fix the cause. Never commit with `--no-verify`.
