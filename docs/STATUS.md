# Status

## How to run it

You need Node.js 24 or later and uv. The commands are the same on Mac, Linux and Windows, and run in this folder.

| Command | Does |
|---|---|
| `npm run dev` | Starts Accountable, installing what's missing first. Open `http://localhost:5173`. Ctrl+C stops it |
| `npm run seed` | Saves a copy of the data, asks, then resets it to the sample data. `npm run seed -- --yes` doesn't ask |
| `npm test` | The type check and every test, in about four minutes. Needs Google Chrome. Uses a database and ports of its own, so Accountable can be running |

The data is in `data/accountable.db`, and the copies are in `data/backups/`. Git ignores both. `npm test` needs the computer to stay awake: a test fails if it sleeps halfway.

## What's done

- Plan: `docs/intent.md` agreed for the MVP.
- Design: `docs/spec.md` agreed for the MVP.
- Look: mockup D chosen from four in `docs/mockups/` (A with two parts from B). Recorded in `docs/spec.md` under Chosen look.
- Build: all nine phases of `docs/plan.md`. Every requirement in `docs/spec.md` is built.
- Test, first part: `npm test` is in `AGENTS.md`. A stray `it.only` in a frontend test now fails it, as `test.only` already did in an end-to-end test.
- Test, second part: the dashboard and pipeline were compared with mockup D using Playwright, and what differed was fixed: the two month charts, the section icons, the digits in late and overdue tags, and small sizes and gaps.

## What's been checked

- `npm test`: 410 backend tests, 187 frontend tests and 112 end-to-end tests in Chrome.
- `npm test` fails when it should: with a failing test in each suite and a type error in each type check, it named all five and exited with 1.
- The dashboard and pipeline, given mockup D's data, beside mockup D at 1280, 1440 and 1920 wide: the same page heights, and under 0.2% of pixels differ. Those are the revenue line's curve, the small icons in Recent activity, and text edges.
- A fresh copy of the project: first start, then a start and a first page load with the network blocked.
- In a terminal: Ctrl+C, and `npm run seed` answered yes, no and Ctrl+C with the app running.
- Every screen by eye at 1280 by 720, 1440 by 900 and 1920 by 1080, and the dashboard and pipeline beside mockup D. The dialogs, messages and empty states at one size.

## Good to know

- **Windows and Linux:** not tried. Three end-to-end tests of the commands are skipped on Windows.
- **Date fields:** while a date is being entered, the browser shows it in the computer's own order, such as 24.11.2026. Everywhere else dates read Nov 24, 2026.
- **Contrast:** white on Cerulean and Raspberry is below 4.5, as accepted in the spec (Q3). The accessibility check leaves out only those two.
- **Changing a table later:** there's no migration tool yet. The first change to a table needs one, or people's data won't open.

## Next

- The rest of the Test stage: use the app by hand.
