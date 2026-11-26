# Status

## How to run it

You need Node.js 24 or later and uv. The commands are the same on Mac, Linux and Windows, and run in this folder.

| Command | Does |
|---|---|
| `npm run dev` | Starts Accountable, installing what's missing first. Open `http://localhost:5173`. Ctrl+C stops it |
| `npm run seed` | Saves a copy of the data, asks, then resets it to the sample data. `npm run seed -- --yes` doesn't ask |
| `npm test` | The type check and every test, in about four minutes. Needs Google Chrome. Uses a database and ports of its own, so Accountable can be running |
| `npm run check` | Prettier, ESLint, ruff, tsc and gitleaks, then `npm test`. Needs gitleaks: `brew install gitleaks` on a Mac, `winget install -e --id Gitleaks.Gitleaks` on Windows |
| `npm run check:quick` | `npm run check` without the end-to-end tests, in about ten seconds |
| `npm run format` | Fixes the formatting that `npm run check` checks |

The data is in `data/accountable.db`, and the copies are in `data/backups/`. Git ignores both. `npm test` needs the computer to stay awake: a test fails if it sleeps halfway.

## What's done

- Plan: `docs/changes/mvp/intent.md` agreed for the MVP.
- Design: `docs/spec.md` agreed for the MVP.
- Look: mockup D chosen from four in `docs/mockups/` (A with two parts from B). Recorded in `docs/spec.md` under Chosen look.
- Build: all nine phases of `docs/changes/mvp/plan.md`. Every requirement in `docs/spec.md` is built.
- Test, first part: `npm test` is in `AGENTS.md`. A stray `it.only` in a frontend test now fails it, as `test.only` already did in an end-to-end test.
- Test, second part: the dashboard and pipeline were compared with mockup D using Playwright, and what differed was fixed: the two month charts, the section icons, the digits in late and overdue tags, and small sizes and gaps.
- Harness, the repo as memory: the MVP's `intent.md` and `plan.md` are in `docs/changes/mvp/`. `docs/spec.md` now describes the whole product, with the problem from the intent and what the review fixes added (G4, G6, G7, G8, P8, API). `AGENTS.md` reads it first, and `docs/REVIEW.md` flags code it doesn't describe.
- Harness, coding standards: `docs/STANDARDS.md`, pointed to from `AGENTS.md` and checked by `docs/REVIEW.md`.
- Harness, the checks: `npm run check`, `npm run check:quick` and `npm run format`, in `AGENTS.md`. What they found is fixed, with no rule weakened. typescript-eslint needs TypeScript 6's API, which TypeScript 7 doesn't have, so `overrides` in `package.json` gives it TypeScript 6. tsc is still TypeScript 7.

## Review findings

From two reviews of `mvp` against `main` with `docs/REVIEW.md`.

The first. All are fixed. Each of 1 to 8 has a test that failed before its fix.

| # | Kind | Finding | Rule | Fix |
|---|---|---|---|---|
| 1 | Important | Other sites on this computer could read and change the data, because Vite allows any `localhost` origin | Spec, API | `cors: false` in `vite.config.ts` |
| 2 | Important | Saving a contact or organization could undo a change made elsewhere while the form was open | Spec, API; C4 | The forms keep what they started with, as the deal form did |
| 3 | Important | A page already opened showed old data with no warning when the server couldn't be reached | G4 | The message shows when anything on screen couldn't be loaded again |
| 4 | Nit | Undoing a win made the contact a lead again, although another of their deals was won since | P8, C4 | A later win keeps them a customer, until it's undone too |
| 5 | Nit | If a half never got ready, `npm run dev` ended after a minute without saying why | R3 | It says which half |
| 6 | Nit | An overdue follow-up on the dashboard didn't show its date | B5 | The date is above its tag |
| 7 | Nit | The browser's Back lost a half-filled form without asking | G6 | Back asks, and the browser asks on refreshing or leaving |
| 8 | Nit | The API answered 500 to a time at the edge of the calendar, and to text that can't be saved | Spec, API | 422 with a message |
| 9 | Nit | `docs/REVIEW.MD` couldn't be found as `docs/REVIEW.md` on Linux | - | Renamed |

The second. 10 to 13 are fixed, each with a test that failed before its fix. 14 and 15 are open: they only showed with saves slowed down on purpose.

| # | Kind | Finding | Rule | Fix |
|---|---|---|---|---|
| 10 | Important | A screen left open past midnight kept yesterday's date until a save or a window focus, so a deal won in the form got yesterday's close date | G8, D3, D6 | It asks for the day every minute, and loads everything again on a new one |
| 11 | Nit | An organization's name in timelines, follow-ups and recent activity wasn't a link | Spec, Frame | It's a link |
| 12 | Nit | Other sites could reach Vite's address that opens files in an editor | Spec, API | That address answers 404 |
| 13 | Nit | A year typed as 26 was saved as 0026, so a won deal left the board without a word | Not in the spec | Dates need a year of four digits, in the forms and the API |
| 14 | Nit | With slow saves, a card dropped above one that's then moved shows at the bottom until the board reloads | P3 | Open |
| 15 | Nit | With a slow first save, ticking and unticking a follow-up can leave it done | A3 | Open |

## What's been checked

- `npm test`: 427 backend tests, 192 frontend tests and 122 end-to-end tests in Chrome.
- `npm run check` passes. `npm run check:quick` leaves out the end-to-end tests, and with a badly formatted, unused variable it named Prettier and ESLint and exited with 1. gitleaks allows a token in `.env` and finds the same token anywhere else, including a `.env` in a subfolder.
- `npm test` fails when it should: with a failing test in each suite and a type error in each type check, it named all five and exited with 1.
- The dashboard and pipeline, given mockup D's data, beside mockup D at 1280, 1440 and 1920 wide: the same page heights, and under 0.2% of pixels differ. Those are the revenue line's curve, the small icons in Recent activity, and text edges. Since then, overdue follow-ups also show their date, which mockup D doesn't, so that panel is taller.
- A fresh copy of the project: first start, then a start and a first page load with the network blocked.
- In a terminal: Ctrl+C, and `npm run seed` answered yes, no and Ctrl+C with the app running.
- Every screen by eye at 1280 by 720, 1440 by 900 and 1920 by 1080, and the dashboard and pipeline beside mockup D. The dialogs, messages and empty states at one size.

## Good to know

- **Windows and Linux:** not tried. Four end-to-end tests of the commands are skipped on Windows.
- **Date fields:** while a date is being entered, the browser shows it in the computer's own order, such as 24.11.2026. Everywhere else dates read Nov 24, 2026.
- **Contrast:** white on Cerulean and Raspberry is below 4.5, as accepted in the spec (Q3). The accessibility check leaves out only those two.
- **Changing a table later:** there's no migration tool yet. The first change to a table needs one, or people's data won't open.

## Next

- The rest of the Test stage: use the app by hand.
