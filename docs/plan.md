# Plan: the Accountable MVP

How to build what `docs/spec.md` describes. Codes such as P8 are its requirements. The look to match is mockup D, `docs/mockups/d-stream-blocks.html`, and the brand skill applies to all UI work.

## Files that change

Everything below is new, except `docs/STATUS.md`. Each test file sits beside or under what it tests.

How the code is organized:

- **By area,** such as deals or contacts, in the backend and the frontend, so a change touches few folders.
- **Shared only when a second place uses it.** Until then, a helper stays next to the code that uses it.
- **No base classes, generic record code or service layers.** Three similar files are easier to change than one clever one.
- **Imports go one way.** Backend: `routes/` uses the areas; the areas use `db`, `tables`, `stages` and `clock`. `deals.py` uses `pipeline.py`, and `contacts.py` and `dashboard.py` use `timelines.py`, never the reverse. Frontend: an area may use another area's form or label, such as `deals/DealForm`; `shared/` uses no area.

### Root

| File | Holds |
|---|---|
| `package.json`, `package-lock.json` | Workspace `frontend`; the scripts `dev`, `test` and `seed`; Playwright, `@axe-core/playwright` and TypeScript for the end-to-end tests |
| `pyproject.toml`, `uv.lock` | Python `==3.12.*`, FastAPI, Uvicorn, SQLAlchemy; pytest and httpx for development; `package = false`; pytest finds `backend/` |
| `scripts/lib.mjs` | Version checks, installing, port checks, starting and stopping processes. Node built-ins only |
| `scripts/dev.mjs`, `scripts/seed.mjs`, `scripts/test.mjs` | The three commands |

### `backend/`

| File | Holds |
|---|---|
| `seed.py` | What `npm run seed` runs: copy, ask, reset (R5, R6) |
| `accountable/settings.py`, `clock.py` | Settings from the environment; `today()` and `now()`, the only places that read the clock |
| `accountable/db.py` | The engine, foreign keys, `read()`, `write()` and `copy()`. The only file that knows it's SQLite |
| `accountable/tables.py` | The six tables, and the statuses and activity types allowed in them |
| `accountable/stages.py` | Stages in order, which are open, usual probabilities, days late. Plain values and functions |
| `accountable/organizations.py`, `contacts.py`, `deals.py`, `activities.py` | Each record's queries and rules, and what deleting it does (X1) |
| `accountable/pipeline.py` | Changing a stage, moving, undoing, order in a column, the board (D4, P3 to P5, P8) |
| `accountable/timelines.py`, `dashboard.py` | A4 to A8; B1 to B6 |
| `accountable/sample_words.py`, `sample_data.py`, `seeding.py` | Invented names and texts; the rows for a given day; loading and resetting |
| `accountable/routes/` | `organizations.py`, `contacts.py`, `deals.py`, `pipeline.py`, `activities.py`, `dashboard.py`, and `general.py` for config and health. Each has its addresses and its own request checks, and calls its area |
| `accountable/errors.py`, `main.py` | Errors as `{message, fields}`; the app, its startup and host check |
| `tests/` | `conftest.py` and the files under Proof |

### `frontend/`

| File | Holds |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `public/favicon.svg` | Setup. The favicon is there because a missing one is a console error |
| `src/main.tsx`, `routes.tsx`, `Frame.tsx`, `styles.css` | Start, addresses, sidebar, fonts, and the brand's colors as Tailwind tokens |
| `src/shared/` | `client.ts` (requests and errors), `queryClient.ts` (refetching and refreshing), `config.ts` (today, now and the stages from the server), `format.ts`, `DataTable` with `tableState.ts`, `FormDialog`, fields, `RecordPicker`, `ConfirmDelete`, `Messages`, `EmptyState`, `ErrorState`, `NotFound`, buttons and panels |
| `src/organizations/` | List, page, form, `queries.ts` |
| `src/contacts/` | List with status filter, page, form, `StatusName`, `queries.ts` |
| `src/deals/` | List, page, form with `suggestions.ts` (D2, D3), `StageName`, `LateTag`, `stages.ts`, `queries.ts` |
| `src/timeline/` | `Timeline`, `ActivityForm`, `queries.ts` |
| `src/pipeline/` | Page, column, card, `board.ts`, `queries.ts` |
| `src/dashboard/` | Page and its parts, `ChartPanel`, `FunnelRibbon` with `ribbon.ts`, `summary.ts`, `queries.ts` |
| `src/testSetup.ts` | Vitest setup |

Each `queries.ts` has its area's requests and the types of their answers.

### `e2e/` and `docs/`

| File | Holds |
|---|---|
| `e2e/playwright.config.ts`, `support.ts`, `tsconfig.json` | Starts the app on ports 5273 and 8100 with its own database; fresh sample data before each test; fails a test on any console error or outside request |
| `e2e/*.spec.ts` | The files under Proof |
| `docs/STATUS.md` | How to run the app, and what's done |

Not changed: `README.md`, `docs/intent.md`, `docs/TECH_STACK.md`, `.gitignore` (it already ignores the database). If building shows that `docs/spec.md` is wrong, stop and ask. `AGENTS.md` gets `npm test` at the Test stage.

## Order of work

Nine phases. Each one ends with its tests passing and the app starting. A phase starts only when the one before is done. Nobody commits but the user.

### 1. Commands and skeleton

1. `package.json`, `pyproject.toml` and the lock files. A backend with only `GET /api/health`, and a frontend with one page in the brand's fonts.
2. `scripts/lib.mjs`:
   - Stop with a plain message if Node.js is below 24 or uv is missing.
   - Run `npm ci` if the hash of `package-lock.json` differs from the one kept in `node_modules/.accountable`. Then run `uv sync --frozen`, which needs no internet once installed.
   - A port is free only if it's free on both `127.0.0.1` and `::1`. Otherwise another project's server could answer at `localhost`.
   - If something has to be installed while the app is running, stop and say to close it first.
   - Start programs without a shell, except npm on Windows. Stop a program and its children: `SIGTERM`, or `taskkill /T /F` on Windows.
3. `dev.mjs`: install, check ports, start `uv run --no-sync uvicorn` without reload, wait for health, start Vite, print the address. If either stops, stop the other and say which (R3).
4. Vite: host `127.0.0.1`, `strictPort`, `/api` passed to the backend, its cache folder set by `ACCOUNTABLE_VITE_CACHE` so tests don't share it with the running app. No lazy-loaded pages, so Vite doesn't reload the page when it meets a new package.
5. `test.mjs`: install, then the type check, pytest, Vitest and Playwright. Run all four even if one fails, and fail if any did. One small test in each suite. Before anything else, the end-to-end support and `conftest.py` refuse to run unless `ACCOUNTABLE_DB` is set to a file in the tests' own temporary folder.

**Done when:** `npm run dev` opens a page, `npm test` passes, and breaking any one test makes it fail.

### 2. Data and sample data

1. `tables.py` as in the spec. Checks in the database: exactly one of `contact_id` and `deal_id` on an activity, value 0 or more, probability 0 to 100, known stages, statuses and types.
2. `db.py`: foreign keys on for every connection with `setconfig`. `write()` takes one lock for the whole program, so two changes can't mix while a column is renumbered. `copy()` uses SQLite's backup.
3. `clock.py`: with `ACCOUNTABLE_TODAY` set, `now()` is that date at the real time of day.
4. `sample_data.py`: a pure function from a day to rows, using its own random generator with a fixed seed. Build deals first, backward from the close date: one to four months, stage changes in order. Then contacts' statuses from their won deals, then activities and follow-ups. This month's won deals close between the 1st and today, even on the 1st. No time is later than today at 0:00, so nothing is in the future just after midnight; on the 1st, this month's deals are won at that moment.
5. `seeding.py`: `prepare_database()` creates the folder and tables, and loads the data if `app_info` doesn't say it finished; loading and that mark are one transaction. Copies go into `backups/` beside the database. `reset()` deletes and reloads in one transaction.
6. `seed.py` and `seed.mjs`, accepting `--yes` as an argument or as `npm_config_yes`.

**Done when:** the first start creates the data, a second keeps it, and `npm run seed` copies, asks and resets, with the app running and not.

### 3. Rules and API

1. **Errors:** one handler turns every failed check into `{message, fields: {name: "Enter a name."}}` with 422, 404 or 409.
2. **Records:** each with its file and its file in `routes/`: lists with the spec's table columns, one record with its linked records, add, edit, delete. Edits use only the fields sent.
3. **Changing a stage,** one function in `pipeline.py` used by edits and moves, in one transaction:
   1. Apply the edit's other fields, so a main contact changed in the same save is the one remembered.
   2. Add the `stage_changes` row with the values from before the edit. `from_status` is filled only if this move changes the contact's status.
   3. Set the stage, the probability (given or usual; always 100 for Won and 0 for Lost) and the close date (given, or today for Won and Lost, or unchanged).
   4. For Won, make the main contact a customer.
   5. Renumber the old and new columns from 0: above `before_id`, at the end for a move with null, or at the top for an edit.
   6. Check D6 on the result.
4. **Adding a deal:** top of its column, C4 if Won, no stage change.
5. **Moving:** in the same column, only positions change. A `before_id` that isn't in the target column is 409.
6. **Undoing:** 409 unless the change is the deal's latest and the deal is still at its `to_stage`. Put back stage, probability, close date, place and the remembered contact's status, then delete the change.
7. **Timelines:** entries `{kind, id, at, type, description, follow_up_on, done, from_stage, to_stage, record}`, where `record` is the deal or contact it belongs to, with its organization. Newest first, then highest id.
8. **Board:** columns with their cards in order; Won and Lost by P4. A card has the fields of P2 plus `days_late`.
9. **Dashboard:** `{today, figures, months, stages, funnel, follow_ups, recent, overdue, late}`. The 12 months start on the first day of the month 11 months ago. For the funnel, an open deal's stages are its current one and both ends of its stage changes, open ones only; a lost deal's is the `from_stage` of its latest change to Lost.
10. **Deletion:** each record's file gives its own numbers for X1, next to its delete. The foreign keys do the rest.
11. **Config:** `{today, now, stages}`. Times leave the API in UTC with a `Z`.
12. **Safety:** host check, no CORS, JSON only. FastAPI already refuses a change sent as plain text, and a test keeps it so.

**Done when:** every backend test under Proof passes.

### 4. Frame and shared parts

1. Colors, sizes, corner radii and spacing from mockup D as Tailwind tokens. Fontsource fonts. Focus ring, reduced motion.
2. Sidebar, addresses, page titles, the page for an unknown address.
3. `client.ts`: an answer that isn't JSON, or no answer, means the server can't be reached (Vite answers 500 in plain text when the backend is down).
4. `queryClient.ts`: `networkMode: 'always'` for queries and changes. Refetch when the tab is shown and when the window gets the focus (the library does only the first by default). Any change that succeeds refreshes everything on screen, in `onSettled`, so nobody keeps a list of what affects what. Card moves are the one exception (phase 7).
5. `format.ts`: dates are split into year, month and day and never go through `new Date('2026-11-24')`, which shows the day before in the Americas.
6. Shared parts on Base UI. `DataTable` on TanStack Table 9: `useTable` and `tableFeatures`, not version 8's `useReactTable`. Its search, sort and filter live in the address. `FormDialog` asks before closing with unsaved changes. `Messages` closes a move's message when any other change succeeds.

**Done when:** the five sections open with their frame, and the unit tests for `shared/` pass.

### 5. Organizations, contacts and deals

1. The three lists with search, sort, status filter, empty states, add, edit, delete.
2. The three forms' fields and checks. `DealForm`: D2 and D3. When the stage changes, always send the stage, probability and close date together; otherwise setting one back to its first value would look unchanged and the server would replace it.
3. Record pages with linked records, and adding already linked. Deleting a record from its own page waits for its list to open before everything is refreshed; otherwise the page would ask for a record that's gone, which is a console error.

**Done when:** success criteria 2 and 3 work in the browser.

### 6. Activities and timelines

1. Timeline on the three record pages. Log activity on contacts and deals, with `ActivityForm`.
2. The time is sent only if the user changed it, so "now" is the server's. The latest time the form allows is also the server's (`now` in config), or it would be wrong with the tests' fixed day. Edit, delete, done and not done. Stage changes have no actions.

**Done when:** success criterion 5 works, except the dashboard's part.

### 7. Pipeline

1. Board, column blocks and cards as in mockup D, each column scrolling on its own.
2. `board.ts`: `moveCard` returns the board after a move, with stage, probability, close date, lateness and totals; `totals` gives P5.
3. On drop, change the stored board at once, before anything waits, then send the move. Otherwise the card jumps back for a moment.
4. Moves are sent one after another. Refresh everything only when none is waiting. While a card is held, ignore new data. On failure, put the board back and show why; on 409, reload.
5. Undo message (P8). Add in a column (P7).
6. A card: dragging from anywhere on it, Space to lift, Enter or a click to open. Its link has `draggable={false}`, so the browser doesn't drag the link itself.

**Done when:** success criterion 4 works with mouse and keyboard.

### 8. Dashboard

1. Figures and the summary line, with its wording for none, one and many.
2. Line and bar charts in Recharts. `FunnelRibbon`, drawn from `ribbon.ts`. Open deals by stage. Each in `ChartPanel` with Show table and a tooltip the keyboard can reach.
3. Follow-ups in two groups with Undo, and recent activity by day.

**Done when:** success criterion 6 works, and the screen matches mockup D at 1440 by 900.

### 9. Whole-app check

1. The remaining end-to-end tests, then `npm test` from the top.
2. Try the first start in a fresh clone, then again with the network off.
3. Use every section and action in a real browser, at the three sizes, looking at each screen (criterion 8). Compare with mockup D. Fix what's found, with a test where one can catch it.
4. `docs/STATUS.md`: how to run, reset and test, and what's done.

**Done when:** every item under Proof is checked, and anything that couldn't be is written down.

## Risks

The riskiest step is phase 7: dragging, saving and reloading happen at once, and mistakes show as flicker or lost moves more often than as errors. The second is the deal rules in phase 3, because four screens depend on them.

| Risk | What it would break | What we do |
|---|---|---|
| The board changes while a card is held or a save is waiting | Cards jump back, or a move is lost | Phase 7, steps 3 and 4; tests with a slow and a failing server |
| `@hello-pangea/dnd` has had no release since February 2025 | The pipeline, if a React update breaks it | It worked with React 19.3 when tested. The lock file fixes versions, and only `src/pipeline/` uses it |
| The end-to-end tests reset the data with `--yes` before each test | The user's own data, if the tests ever used the app's database | They refuse to start without a database of their own. The reset also makes a copy first |
| Refreshing everything asks for a record just deleted | A console error in everyday use (Q5) | Leave its page first (phase 5, step 3); tested by deleting from each record's page |
| A stage change leaves part of the work undone | Probability, contact status, timeline or funnel disagree | One function, one transaction, a test for each rule and for undoing each |
| Undo puts back the wrong thing | A contact's status or a card's place | It only undoes the latest change, from values saved with it |
| Sample data fails on some days | The first start, for someone else, on the 1st or on Feb 29 | Test S1 to S4 for awkward days, not only today |
| Dates and time zones | Wrong day, month or "late" | One clock, one formatter, tests west and east of UTC |
| TanStack Query waits while the computer is offline | Nothing loads without internet, though the server is local (R2) | `networkMode: 'always'`; a test with the browser offline |
| TanStack Table 9 and React Router 8 are new, and most examples are for older versions | Time lost on wrong code | Follow the installed packages' own types. Checked: Table 9 has `useTable`; Router 8 has `createBrowserRouter` in `react-router` and `RouterProvider` in `react-router/dom` |
| Chrome writes a console error for every answer of 400 or above, even one the app handles well | Q5, and every end-to-end test | Forms check before sending, so everyday use causes none. Q5 allows the four cases that still do, and those tests name the error they expect |
| Windows and Linux can't be tried on this Mac | R1, R3 and R5 there | No shell commands, children stopped by platform. Say in `docs/STATUS.md` that they're untested |
| Files in the database's folder are locked on Windows | Reset while the app runs | Reset changes rows, it doesn't replace the file |
| Other web pages calling the server | Someone's data, with no sign-in | Phase 3, step 12, with tests |
| White on Cerulean and Raspberry is hard to read | Some users, and the contrast check | Accepted in the spec (Q3); the check leaves out only those two pairs |
| The end-to-end tests become slow or unreliable | Nobody runs them | One at a time, fixed date, fresh data each, no fixed waits |

What this could break today: no existing code, because there's no app yet, and no course files. What it could break on the computer or later:

- **The user's data:** by a reset (it asks and copies first), by the tests (see the table), or by a later change to a table (see migrations below).
- **Other projects on ports 5173 and 8000:** the command stops and names the port, and never closes anything.
- **A running Accountable, if `npm test` had to install packages:** it stops and says so instead.

Decided against:

- **A library for the funnel's ribbon:** Recharts has no funnel of this shape, and bending its area chart into one is more work than drawing it. It's one pure function and one small component.
- **Sorting the frontend by type** (`pages/`, `forms/`, `lib/`): a change to deals would touch four folders.
- **A list of what each change refreshes:** one forgotten line shows old figures. With a few hundred records on the same computer, refreshing everything is quick enough.
- **Layers for the future,** such as a repository layer, generic record code, or a `crm/` folder for a later ERP: they'd be guesses. Files can move when a second area needs it.
- **Preparing for sign-in:** every query will need to know whose data it is, whatever the structure. The intent leaves it for later.
- **`@dnd-kit`:** more popular, but more to write by hand for a board.
- **One process that serves the built frontend:** fewer parts to run, but `docs/TECH_STACK.md` says the command starts both.
- **Auto-reload of the backend:** it adds a second process to stop, and the person running the command is a salesperson.
- **Types made from the API's description:** one more step to run. The types are few and written by hand.
- **A database migration tool:** there's no older database to move yet. The first later change to a table needs one, or it would break data people already have.
- **Writing for Postgres now:** moving to Supabase changes `db.py` and `settings.py`. The lock in `write()` works for one server program, and would be replaced then.
- **Running the end-to-end tests at the same time:** each would need its own servers. It can come later if they're slow.
- **A page that only tests use, to reset the data:** the real reset command does it, and gets tested each time.

## Proof

`npm test` runs the type check, then everything below except "By hand". The codes are what each test proves.

### Backend unit tests (pytest, `backend/tests/`)

Each test has its own database file and a fixed day, unless it says otherwise.

`test_sample_data.py`
1. The amounts and make-up of S1, and the same rows twice for the same day (S1).
2. S1 to S4 hold on Jan 1, Feb 28, Feb 29, Mar 31, Nov 1, Nov 24 and Dec 31 (S1, S2, S3, S4).
3. Every won month has a deal, four open deals are late, others close within four months, both closed columns have cards (S2).
4. Stage changes run in order to the current stage, main contacts work at the deal's organization, main contacts of won deals are customers (S3).
5. All websites and emails end in `.example`, all phones have 555-01 (S4).
6. Loaded one minute after midnight, nothing that has happened is in the future, also on the 1st.

`test_seeding.py`
1. A missing file is created with the data (R4).
2. A second start changes nothing, and deleting every record doesn't bring the data back (R4).
3. Loading that stops halfway is done again from the beginning (R4).
4. The copy opens and has the same rows, also while another connection reads (R5).
5. A reset that fails leaves the old data (R5).

`test_seed_command.py`
1. Yes resets, no changes nothing and leaves the copy (R5).
2. `--yes` skips the question; no terminal and no flag fails and changes nothing (R6).

`test_records.py`
1. Add, read, edit and delete each kind; an edit changes only the fields sent (O1, C1, D1).
2. Each required field, the email, the website's `http` and `https`, value and probability limits: 422 with a message for the field (O1, C1, D1, G6).
3. Two contacts can share a name and an email (C1).
4. List columns: counts, open value, expected revenue, last activity, next follow-up (T1, T5).
5. A deal with no organization or contact, and one whose contact works elsewhere (D2).
6. A missing record is 404 (G4).
7. Organization page figures: open value and value won (O2).

`test_stage_changes.py`
1. Every pair of stages: the probability, by an edit and by a move (D3, D4).
2. A probability or close date given with the change is kept; Won is always 100 and Lost 0 (D3, D4).
3. Won and Lost set today; reopening keeps the date (D4).
4. A probability set by hand stays until the stage changes (D4).
5. Winning and adding as Won make the main contact a customer; losing, reopening, or changing the contact later doesn't change a status (C4).
6. The entry is added, with the main contact saved in the same edit (D4, A5).
7. A closed deal's date can't be after today, by add, edit and move (D6).
8. Late: yesterday yes, today no, closed no (D5).

`test_moves.py`
1. To the top, middle and end; within a column, up and down; into an empty column (P3).
2. Within a column nothing but the order changes, and no entry is added (P3).
3. After any move every column is numbered from 0 with no gaps.
4. Below older hidden Won cards, the order shown is kept (P3, P4).
5. A neighbor that has gone, or is in another column, is 409.
6. An edited stage and a new deal go to the top (D4, P7).
7. Twenty moves sent at once leave every column numbered from 0 with no gaps.

`test_undo.py`
1. Undo puts back stage, place, probability, close date and status, and removes the entry everywhere (P8).
2. A contact who was already a customer stays one (P8).
3. An older change, a second undo and an unknown one are 409 (P8).
4. The funnel and figures are as before the move (P8, B4).

`test_board.py`
1. Six columns in order, cards in order (P1, P2).
2. Closed 90 days ago shows, 91 doesn't (P4).
3. Totals and expected revenue for the board and each column (P5).

`test_timelines.py`
1. An activity on a deal shows on the deal and its main contact, not on a later main contact (A4, A5).
2. An activity on a contact doesn't show on their deals (A6).
3. An organization shows each entry once; a contact who leaves takes theirs along (A7).
4. Newest first, also at the same time; each entry names its record (A8).
5. Log, edit, delete, done and not done; the record can't be changed (A1, A2, A3).
6. A description is required and the time can't be in the future (A1).
7. A stage change can't be edited or deleted (A5).

`test_deletion.py`
1. Each row of X1: what's kept, unlinked and deleted, and that the numbers announced match what happens (X1).
2. Deleting a contact keeps deal activities and stage changes, without the contact (X1).

`test_dashboard.py`
1. The four figures, and zero for each when there's nothing (B1).
2. Twelve months, including ones with none; the first day of the first month counts and the day before doesn't (B2).
3. Open value and expected revenue by stage (B3).
4. Each funnel row: open, moved back, won, reopened, lost, lost from Won, added as Lost, closed before the 12 months; shares (B4).
5. Won in the funnel equals the 12 months' revenue (B2, B4).
6. Follow-ups: 14 days yes, 15 no, done no, order (B5).
7. The newest 10 entries, each once (B6).

`test_api_safety.py`
1. Another host name is refused; another site gets no permission; a change sent as plain text is refused.
2. `today`, `now`, stages and probabilities in config (G8, D3).

### Frontend unit tests (Vitest, beside the code)

1. `format`: money, rounding only when shown, dates and times, in Los Angeles, London and Tokyo (G7, G8).
2. `board`: `moveCard` across, within, into an empty column, to Won and Lost, reopened and late; totals (P5, P6).
3. `suggestions`: the stage's, closed deals' fixed probability, contact fills in the organization, the organization's contacts first; and the form always sends the three fields together (D2, D3).
4. `tableState`: search, sort and filter to and from the address (G2).
5. `DataTable`: search ignoring case, two-way sort, blanks last, stage and status order, rows shown, empty state (T1, T2, T3, G5).
6. Status filter counts, with a search (T4).
7. `FormDialog`: problems beside fields, also the server's; asking before losing changes (G6).
8. `ConfirmDelete`: wording for none, one and many, leaving out what doesn't apply (X1).
9. `ribbon`: thickness follows value; zero and equal values draw without errors (B4).
10. `summary`: none, one and many (Look).
11. `client`: field problems, not found, no server, an answer that isn't JSON (G3, G4).
12. `Timeline`: the actions an entry has, its record's link, overdue and done (A2, A3, A5, A8).
13. `LateTag`, `StageName` and `StatusName` always show their words (D5, Q3).
14. `queryClient`: a change refreshes everything; card moves do so only after the last one is saved (G3, B7, P6).

### End-to-end tests (Playwright, `e2e/`)

Chrome, one at a time, on Nov 24, 2026, with fresh sample data. Every test also fails on a console error, or a request outside the computer (Q5, R2). A test that makes a request fail on purpose names the console error it expects, and only in Q5's four cases.

`start.spec.ts`
1. Opens on the dashboard, and all five sections have sample data (G1, R1, S1).
2. Each section's and record's address works after a refresh, in a new tab and with Back; an unknown address and a deleted record get their page (G2, G4).
3. After the browser's `offline` event, pages still load and save (R2). Playwright's `setOffline` can't be used, because it blocks the local server too.
4. When the server stops, the screen says so, and Try again works once it's back (G4).

`commands.spec.ts`
1. A taken port is named, and nothing keeps running (R3).
2. When one half stops, the command says which and stops the other (R3).
3. `seed` with each flag spelling; without a terminal it fails and changes nothing (R6).
4. Data changed before a restart is there after it (R4, criterion 2).
5. The app's own data file is the same before and after the tests, and they refuse to start without a database of their own (R7).

`organizations.spec.ts`, `contacts.spec.ts`, `deals.spec.ts`
1. For each: add, find, sort by every heading both ways, edit, delete with the right message, from the table and from the record's page, still so after a refresh (T1, T2, T3, X1, O1, C1, D1).
2. Search and sort are still there after opening a record and going back (G2).
3. Contacts: filter by status together with search (T4).
4. After deleting an organization and a contact, their contacts and deals are still there, without the link (X1).
5. Linked records on each page; add a contact and a deal from an organization, and a deal from a contact, already linked (O2, O3, C2, C3, D7).
6. A late deal stands out in the table and on its page (D5).
7. A wrong value shows its problem; closing with changes asks (G6).
8. The stage suggestions in the form, and setting a value back by hand is kept (D3).
9. A change made in a second tab shows when this one gets the focus (G9).
10. A failed save shows a message and the old value (G3).

`timelines.spec.ts`
1. Log a note, call and email on a contact and on a deal; they show in the right timelines, newest first (A1, A4, A6, A7, A8).
2. Edit, delete, done and not done (A2, A3).
3. A stage change shows on the deal, its contact and the organization, with no actions (A5).

`pipeline.spec.ts`
1. Six columns fit at 1280, each scrolls on its own, Won and Lost say "Last 90 days" (P1, P4).
2. Drag to another column: stage, probability, figures at once; the same after a refresh; the Deals table shows both (P3, P5, P6).
3. Drag within a column, to the top, middle and end; the same after a refresh (P3).
4. Move with the keyboard (P3, Q2).
5. Won: today's date, customer, timeline entry. Lost: today's date. Reopened: the date stays (D4, C4).
6. Undo after Won puts everything back; the message goes after 10 seconds, stays while pointed at, and goes after another change (P8).
7. The server answers slowly: the card stays put. It fails: the card goes back with a message (P6, G3).
8. Three quick moves are all kept (P3).
9. Add in a column: it starts at that stage, on top (P7).
10. A late card stands out; a click and Enter open the deal (P2, D5).

`dashboard.spec.ts`
1. Figures, charts, funnel and stages equal what the Deals table adds up to (B1, B2, B3, B4).
2. They change after a deal is won, and after a new follow-up (B7).
3. Follow-ups: groups and order; marking one done removes it, and Undo brings it back (B5).
4. Recent activity: ten entries, linked (B6).
5. Show table on each chart; tooltips by mouse and keyboard (Look, Q2).

`quality.spec.ts`
1. At 1280 by 720, 1440 by 900 and 1920 by 1080, no screen scrolls sideways; at 1440 by 900 the figures, both charts and the funnel's top show (Q1).
2. The accessibility check (axe) on every screen and dialog (Q2, Q3).
3. Add, edit, delete and log an activity with the keyboard only, with focus visible (Q2).
4. With reduced motion, nothing animates (Q4).
5. Empty states, after deleting everything (G5).

### By hand

1. A fresh clone starts with `npm run dev`, then starts again with the network off (R1, R2, criterion 1).
2. Ctrl+C stops both halves (R3).
3. `npm run seed` in a terminal, yes and no, with the app running (R5).
4. Every screen beside mockup D and the brand skill, at the three sizes (criterion 7).
5. Every section and action the way a salesperson would use them, with the console open (criterion 8).
6. Windows and Linux: not possible here, so it's noted in `docs/STATUS.md`.
