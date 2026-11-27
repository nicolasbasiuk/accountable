# Spec: Accountable

What Accountable is and exactly how it behaves today, as a whole. The technology follows `docs/TECH_STACK.md`, and the look follows the brand skill, which takes priority over any general design guidance.

## Product

### Problem

A small business keeps track of its customers and sales in spreadsheets, inboxes and people's heads. Nobody can see at a glance which companies we deal with, who our contacts are, what's in the sales pipeline, what happened last with a customer or what needs doing next.

### What it is

Accountable is a business management system: a sales CRM that will grow into a full Business OS, including ERP. Today it's a complete sales CRM for one person, running on their own computer: a private Salesforce that does the everyday CRM essentials really well. It feels sharp, modern and professional, is a pleasure to use, and its dashboard is visually stunning.

### Users

- One salesperson at a small IT or software services firm that sells to other businesses, using Accountable on their own computer every day.
- No other systems are involved.

### Limits

- It runs locally with one command on Mac, Linux and Windows (R1). The first start installs what's missing and needs an internet connection; after that, none is needed (R2).
- It's sized for the sample data and light use: a few hundred of each kind of record, with no speed target.
- Every change is kept: it's still there after a refresh and after a restart.
- Light and dark mode (G10), for a laptop or desktop screen (Q1).

## Decisions

Questions settled in the design, and the answers:

| Concern | Answer |
|---|---|
| A card dropped on Won by mistake can't be fully put back | Undo after a move (P8) |
| The funnel's period | Open deals, and deals closed in the last 12 months (B4) |
| A won deal that's reopened or refused | Not counted as won in the funnel: Won counts only deals that are Won now (B4) |
| Each stage's usual probability | New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100%, Lost 0% |
| Totals of the Won and Lost columns | The cards shown (P4, P5) |
| Six stages, five brand colors | Brand order for the four open stages. A won deal shouldn't look like a warning, so Won is Midnight and Raspberry only means late or overdue |
| White text on Cerulean (contrast 3.96) and Raspberry (3.62) is below the usual 4.5 | The exact brand colors (Q3) |
| Won's Midnight almost vanishes on the dark page (1.35) and black cards (1.74) | In dark mode Won is Sea Mist, the ink on dark, as Midnight is the ink on light. Lost's column block, Sea Mist in light mode, is Midnight in dark mode, so Won and Lost never look the same |
| Where the light or dark choice is kept | In the browser: no backend change, and a dark page never flashes light. A different browser starts in light (G10) |
| Black menus, tooltips and messages would vanish over black panels | In dark mode they're Midnight, lighter than the panels they open over. Messages are already Midnight in light mode, so they don't change |
| The Cerulean focus ring is under 3 to 1 on Sea Green (2.1), Marigold (2.4) and dark mode's Sea Mist (2.7) | Kept as it is, 3 pixels wide (Q2) |
| The sample data's dates get old | Fine: `npm run seed` renews them |

## Requirements

### General

- **G1** Five sections in a sidebar: Dashboard, Organizations, Contacts, Deals, Pipeline. Dashboard opens first.
- **G2** Every section, and every record's page, has its own address. Refreshing, going back and opening a link in a new tab all work. A table's search, sort and filter are still there after opening a record and going back.
- **G3** A change is saved on the server before the app says so. If saving fails, the screen goes back to what it was and a message says what went wrong.
- **G4** If the server can't be reached, the screen says so and offers Try again. A page that's already open says so too when anything on it couldn't be loaded again. A record that no longer exists gets a page saying so, with a link to its list.
- **G5** Every list has an empty state that says what goes there and offers the action to add it, if there is one.
- **G6** Forms show a problem beside the field it's about. Closing a form with unsaved changes asks first, and so do the browser's Back, refreshing and leaving the page.
- **G7** Money is whole US dollars with the currency, such as $125,000. Dates read Nov 24, 2026, and need a year of four digits, in the forms and the API. Open value is the total value of the open deals. Expected revenue is value times probability, and is rounded only when shown.
- **G8** "Today" is the server's local date, everywhere. The app asks for it every minute, and loads everything again on a new day, so a screen left open past midnight follows it. Times are shown in local time.
- **G9** Another tab's changes appear when this one gets the focus. If two tabs edit the same record, the last save wins.
- **G10** A Dark mode switch at the foot of the sidebar, so on every page, turns dark mode on and off. Light is the default. The choice is kept in the browser, so it's still there after a refresh and a restart, and other open tabs switch too. It's applied before the page first draws, so a dark page never flashes light. Everything follows the mode, including charts, dialogs, menus and messages.

### Tables

- **T1** Organizations, Contacts and Deals are tables with a search box, sorting by clicking a heading (ascending, then descending), an Add button, and Edit and Delete on each row. The number of rows showing is always visible.
- **T2** Search looks for the text anywhere in the fields listed below, ignoring case. Blank values sort last. Stages sort in pipeline order, and statuses from lead to customer.
- **T3** There are no pages: the table scrolls under a fixed heading row. Clicking a row opens the record.

| Table | Columns | Searches | First sorted by |
|---|---|---|---|
| Organizations | Name, Industry, Website, Contacts (number), Open deals (number), Open value | Name, industry, website | Name |
| Contacts | Name with job title, Organization, Status, Email, Phone, Last activity, Next follow-up | Name, job title, organization, email, phone | Name |
| Deals | Name, Organization, Main contact, Stage, Value, Probability, Expected revenue, Close date | Name, organization, main contact, stage | Close date, latest first |

- **T4** Contacts has a status filter: All, Lead, Qualified, Customer, each with its count. It works together with the search.
- **T5** Last activity is the newest entry in the contact's timeline, and Next follow-up is the earliest one not done in it.

### Organizations

- **O1** Fields: name (required), website, industry, notes. Website accepts an address with or without `https://` and is shown as a link; only `http` and `https` are allowed. Industry is free text that suggests the ones already in use.
- **O2** The page shows its fields, open value, value won, contacts, deals, and timeline (A7).
- **O3** Add contact and Add deal on the page open the form with the organization already chosen.

### Contacts

- **C1** Fields: name (required), email, phone, job title, organization (optional), status (lead unless changed). An email must look like one. Two contacts can share a name or an email.
- **C2** The page shows their fields, organization, the deals where they're the main contact, and their timeline (A6).
- **C3** Add deal on the page opens the form with the contact and their organization already chosen.
- **C4** When a deal becomes Won, or is added as Won, its main contact at that moment becomes a customer. Nothing else changes a status except editing it, or undoing that move (P8).

### Deals

- **D1** Fields: name (required), organization (optional), main contact (optional), stage (New unless changed), value (required, 0 or more), probability (0 to 100), close date (required).
- **D2** The main contact can be anyone. The list shows the chosen organization's contacts first, and choosing a contact while the organization is blank fills in theirs.
- **D3** The usual probabilities are New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100% and Lost 0%. Choosing a stage in the form fills in its usual probability, and for Won or Lost sets the close date to today. Both can be changed before saving, except that a Won deal is always 100% and a Lost one 0%.
- **D4** However a deal's stage changes (a drag or the form), the same things happen together:
  1. It takes the new stage's usual probability, unless one was given with the change.
  2. Moving to Won or Lost sets the close date to today, unless one was given. Moving back to an open stage leaves it as it is.
  3. Moving to Won applies C4.
  4. "Moved from Proposal to Negotiation" is added to the timeline (A5).
  5. The deal goes to the top of its new column, unless it was dropped in a place.
- **D5** A deal is late when it's open and its close date is before today. It's marked Late with the number of days, in the table, on its card and on its page.
- **D6** A Won or Lost deal's close date can't be after today.
- **D7** The page shows its fields, expected revenue, where it is among the stages, and its timeline (A4).

### Pipeline

- **P1** Six columns in order: New, Qualified, Proposal, Negotiation, Won, Lost. All six fit across a 1280-pixel screen, and each column scrolls on its own.
- **P2** A card shows the deal's name, organization, value, probability, close date and Late mark. Clicking it opens the deal.
- **P3** A card can be dragged to any place in any column, or moved with the keyboard, and stays there after a refresh. A place change inside a column changes nothing else.
- **P4** Won and Lost show deals with a close date from 90 days ago to today, and say "Last 90 days".
- **P5** The top of the board shows the number, total value and expected revenue of the open deals. Each column shows the same three for its own cards.
- **P6** The figures, the card's probability and its Late mark change the moment it's dropped, before the server answers. If saving fails, the card goes back (G3).
- **P7** Each column has an Add button that opens the deal form at that stage. The new card appears at the top of the column.
- **P8** After a card moves to another column, a message says where it went and offers Undo. Undo puts back the deal's stage, place, probability and close date, and its main contact's status if the move changed it, unless the status was changed by hand since or another of their deals was won since. It removes the "Moved" entry from every timeline, as if the move hadn't happened. The message stays for 10 seconds, longer while it's pointed at or focused, and goes when anything else is changed. Only a deal's latest change of stage can be undone.

### Activities and timelines

- **A1** On a contact's or deal's page, Log activity takes a type (note, call or email), a description (required), when it happened (now unless changed, never in the future) and an optional follow-up date.
- **A2** An activity can be edited and deleted from any timeline it appears in. The record it was logged on can't be changed.
- **A3** A follow-up has a checkbox to mark it done, or not done again.
- **A4** A deal's timeline has its activities and its changes of stage.
- **A5** An activity logged on a deal, and a deal's change of stage, remember who the main contact was when they were saved. Changing the main contact later doesn't move them. Changes of stage can't be edited or deleted, only undone (P8).
- **A6** A contact's timeline has the activities logged on them, plus the entries from A5 that remember them.
- **A7** An organization's timeline has everything in the timelines of its current contacts and deals, each entry once. Activities can't be logged on an organization.
- **A8** Timelines are newest first. An entry that belongs to another record names it and links to it.

### Dashboard

- **B1** Figures: revenue won this month with the number of deals, revenue won over the 12 months, open value with the number of deals, and expected revenue.
- **B2** Line chart: revenue won in each of the last 12 months, including this one. Bar chart: the number of deals won in the same months. Months without any show zero. Both use the close date of deals that are Won now.
- **B3** Pipeline by stage: the total value and the expected revenue of each open stage.
- **B4** Funnel: the value and number of deals that reached New, Qualified, Proposal, Negotiation and Won, and each stage's share of the one before. It covers open deals and those closed in the same 12 months. A deal counts at every stage up to:

| Deal | Counts up to |
|---|---|
| Open | The furthest open stage it has been in |
| Won | Won |
| Lost | The stage it was lost from; Negotiation if that was Won; New if it was added as Lost |

- **B5** Follow-ups: every one not done that's overdue or due within 14 days, overdue first, then soonest. Each shows its date, description and record, with a checkbox. Marking one done removes it and offers Undo.
- **B6** Recent activity: the newest 10 entries from all timelines, each once and linked to its record.
- **B7** Every figure comes from the saved data, and is up to date each time the dashboard opens.

### Deleting

- **X1** Deleting asks first, names the record and says what happens to the others, with numbers. Parts that don't apply are left out.

| Deleted | What happens | What it says |
|---|---|---|
| Organization | Its contacts and deals stay, with no organization | "4 contacts and 3 deals are kept, with no organization." |
| Contact | Their deals stay, with no main contact. Activities logged on the contact are deleted. Activities on deals stay | "2 deals are kept, with no main contact. 5 activities are deleted, 1 with a follow-up still to do." |
| Deal | Its activities and changes of stage are deleted, so they leave its contact's timeline too | "6 activities are deleted, 2 with a follow-up still to do." |
| Activity | Only the activity | "Its follow-up is deleted too." |

### Running and data

- **R1** `npm run dev` starts everything on Mac, Linux and Windows, given Node.js 24 or later and uv. If packages are missing or out of date it installs them first, saying so. It then prints the address to open, `http://localhost:5173`.
- **R2** Once installed, the app makes no request outside the computer. Fonts and icons come with it.
- **R3** If a port is taken, or either half stops, the command says which and stops both. Ctrl+C stops both.
- **R4** The data is one file, `data/accountable.db`, which Git ignores. If it doesn't exist it's created with the sample data. If loading is interrupted, the next start loads it again from the beginning. Deleting every record doesn't bring the sample data back.
- **R5** `npm run seed` saves a copy as `data/backups/accountable-2026-11-24-153012.db`, asks for confirmation, then replaces everything with the sample data. It works whether or not the app is running. Answering no changes nothing but leaves the copy.
- **R6** `npm run seed -- --yes` and `npm run seed --yes` both skip the question. With no one to ask and no flag, it changes nothing and fails.
- **R7** Tests use their own database file and ports, so they can run while the app does.

### Sample data

- **S1** A small IT services firm's data, with dates set relative to the day it's loaded and the same result each time on the same day.

| Record | Amount | Make-up |
|---|---|---|
| Organizations | 24 | At least 8 industries |
| Contacts | 60 | About 25 leads, 15 qualified, 20 customers |
| Deals | 96 | 44 open (16 New, 12 Qualified, 9 Proposal, 7 Negotiation), 34 won, 18 lost; $5,000 to $150,000 |
| Activities | About 220 | 25 follow-ups not done: 6 overdue, 10 due within 14 days, 9 later |

- **S2** Every one of the last 12 months has a won deal, 4 open deals are late, and the other open deals close over the next 4 months. The Won and Lost columns both have cards.
- **S3** It's consistent: deals took one to four months, their changes of stage run in order up to the current stage, main contacts work at the deal's organization, and the main contact of a won deal is a customer.
- **S4** All people and companies are invented, with `.example` addresses and 555-01 phone numbers.

### Quality

- **Q1** Works in current Chrome from 1280 by 720 up, checked at 1280 by 720, 1440 by 900 and 1920 by 1080.
- **Q2** Everything can be done with the keyboard, focus is always visible, and every control has a name a screen reader can read.
- **Q3** Text contrast is at least 4.5 in both modes, except the brand's white on Cerulean and Raspberry, which is always semi-bold and at least 14 pixels. Color is never the only sign of anything.
- **Q4** Motion is short, and off when the computer asks for reduced motion.
- **Q5** No errors in the browser's console on any screen or action, except the one Chrome writes itself when a request fails: a record that's been deleted, a conflict, a failed save or a server that can't be reached.

## Design

### Parts

```
Browser (React) --/api--> Vite, localhost:5173 --> FastAPI, 127.0.0.1:8000 --> data/accountable.db
```

The backend owns every rule: stage changes, lateness, timelines, the funnel and the dashboard's figures. The frontend repeats only the pipeline totals, so they can change before the server answers, and the form's suggestions in D3.

| Part | Choice | Why |
|---|---|---|
| Backend | FastAPI, Pydantic, SQLAlchemy Core | `TECH_STACK.md` |
| Server data in the frontend | TanStack Query | Refetching, and undoing a failed change |
| Pages | React Router | Addresses (G2) |
| Tables | TanStack Table | Search and sort, in the browser: a few hundred rows |
| Charts | Recharts | Line, bar and pipeline visuals. The funnel's ribbon isn't a standard chart, so it's a small drawing of its own |
| Pipeline | `@hello-pangea/dnd` | Made for boards, with the keyboard built in |
| Dialogs, menus, pickers, messages | Base UI | Accessible, without a look of its own |
| Forms | React Hook Form | |
| Styling, icons, fonts | Tailwind CSS, Lucide, Fontsource | Fonts are packages, so they work offline |
| Colors | Tokens in `frontend/src/styles.css`, each with a light and a dark value | One place for colors, no new dependency, and nothing for either mode scattered through the screens |

Checked when they were chosen:

- **Drag and drop:** `@hello-pangea/dnd` 18 has had no release since February 2025. With React 19.3 in Chrome, dragging across columns that scroll on their own, dragging within one and moving by keyboard all worked. The test had no sidebar; beside a 208-pixel one at 1280 pixels, each column is about 160 wide. `@dnd-kit/core` is more popular, but its last release is older and it leaves more to write by hand.
- **Links between records:** Python 3.12 can turn on SQLite's foreign keys with `setconfig`, so keeping, unlinking and deleting (X1) happen in the database with no raw SQL.

### Data

| Table | Columns |
|---|---|
| `organizations` | `id`, `name`, `website`, `industry`, `notes` |
| `contacts` | `id`, `name`, `email`, `phone`, `job_title`, `status`, `organization_id` → set null |
| `deals` | `id`, `name`, `organization_id` → set null, `contact_id` → set null, `stage`, `value`, `probability`, `close_date`, `position` |
| `activities` | `id`, `type`, `description`, `happened_at`, `follow_up_on`, `done`, `contact_id` → cascade, `deal_id` → cascade, `deal_contact_id` → set null |
| `stage_changes` | `id`, `deal_id` → cascade, `contact_id` → set null, `from_stage`, `to_stage`, `changed_at`, and for P8 `from_probability`, `from_close_date`, `from_position`, `from_status` (blank if the contact's status didn't change) |
| `app_info` | `key`, `value`; records that the sample data finished loading (R4) |

- The word after each arrow is what happens when the linked record is deleted. An activity has exactly one of `contact_id` and `deal_id`, which is where it was logged; `deal_contact_id` is the main contact A5 remembers.
- `value` and `probability` are whole numbers. Dates have no time zone. Times are stored in UTC.
- Stage changes have their own table because the funnel depends on them, so they mustn't be edited or deleted like activities.
- `position` is the order in a column. A move renumbers the whole column in the same transaction as everything in D4.
- Column types are portable, for the later move to Supabase's Postgres.

### API

JSON under `/api`. An edit sends only the fields that changed. Invalid fields return 422 with a message for each, a missing record 404, and a move beside a card that has gone 409, after which the board reloads.

| Request | Does |
|---|---|
| `GET` and `POST /organizations`, `/contacts`, `/deals` | Lists with the table's columns; adds one |
| `GET`, `PATCH`, `DELETE /organizations/{id}`, and the same for contacts and deals | One record with its linked records; edits; deletes |
| `GET /organizations/{id}/timeline`, and the same for contacts and deals | Its timeline |
| `GET /organizations/{id}/deletion`, and the same for contacts and deals | The numbers in X1 |
| `GET /board` | The pipeline's cards in order |
| `POST /deals/{id}/move` | `{stage, before_id}`: moves it above that card, or to the end of the column if null. Returns the change of stage, if there was one |
| `POST /deals/{id}/undo` | `{stage_change_id}`: undoes that move (P8), or 409 if it isn't the deal's latest |
| `POST /activities`, `PATCH`, `DELETE /activities/{id}` | Logs, edits or marks done, deletes |
| `GET /dashboard` | Everything on the dashboard |
| `GET /config` | Today, the stages and their usual probabilities |
| `GET /health` | Whether the server is ready |

There's no sign-in, so the server listens on `127.0.0.1` only, refuses any host name other than `localhost` and `127.0.0.1`, allows no other site to call it, and takes changes only as JSON. Vite's address for opening files in an editor answers 404.

### Commands and settings

- The scripts are Node and Python only, with no shell commands, so they're the same on Windows. The one behind `npm run dev` uses nothing that has to be installed first.
- The backup in R5 uses SQLite's own backup, and the reset is one transaction, so both are safe while the app runs.
- `npm run check` runs Prettier and ESLint on the frontend, ruff format and ruff check on the backend, tsc, gitleaks, then `npm test`. All of them run, even if one fails, and it says which failed. `npm run check:quick` leaves out the end-to-end tests, and `npm run format` fixes the formatting.
- Each commit runs the pre-commit hook in `lefthook.yml`: Prettier and ruff format on the staged files, which stay staged, then ESLint, ruff check, tsc and gitleaks. Any failure stops the commit. It leaves out the tests. The first install sets the hook up, because `--ignore-scripts` stops lefthook doing it itself.
- CI, in `.github/workflows/ci.yml`, runs on every push to any branch. Its one job, `check`, runs gitleaks on every commit in the history, so a secret that a later commit removed still fails it, and stops there if it finds one. Then it installs Node and uv and runs `npm run check:quick`. It uses no secrets.
- `ACCOUNTABLE_DB` sets the database file, `ACCOUNTABLE_TODAY` fixes today's date, and the ports can be set too. Tests use these; nobody else needs them.

### Screens

- **Frame:** a 208-pixel sidebar with the five sections and, at its foot, the Dark mode switch, then the page: a heading, one main action, the content. A record's name is a link wherever it appears.
- **Dashboard:** the four figures across the top; the line and bar charts; the funnel (B4) as one ribbon across the page, narrowing from New to Won; the pipeline by stage (B3) as a panel of bars, with expected revenue in the solid part of each; then follow-ups, grouped into overdue and due, beside recent activity, grouped by day. At 1440 by 900 the figures, both charts and the top of the funnel show without scrolling.
- **Lists:** search and filter on the left, Add on the right, the table in one panel.
- **Record pages:** details on one side with Edit and Delete, linked records under them, and the timeline beside them with Log activity at its top.
- **Pipeline:** the board's figures, then six equal columns filling the height. Each column starts with a rounded block in its stage's color, all the same size, holding its name, figures and Add button; its cards follow. On a screen narrower than 1280 pixels the page scrolls sideways.
- **Forms:** one dialog for each kind of record, the same wherever it's opened.

### Look

Fonts:

| Use | Font |
|---|---|
| Headings, body, labels | Instrument Sans |
| Money, percentages, counts, dates, chart axes | JetBrains Mono, with digits of equal width |
| The one line under the Dashboard heading, such as "6 follow-ups are overdue and 4 deals are late." | Instrument Serif |

Colors, in light mode, the default, and dark mode (G10):

| Use | Light | Dark |
|---|---|---|
| Page | `#F0F4F5` | `#04232E` |
| Panels, cards and dialogs, rounded, no outline | White | Black |
| Menus and tooltips | White | Midnight |
| Text | Midnight `#073B4C` | Sea Mist `#CDD8DB` |
| Secondary text | `#4F6C78` | `#93A9B1` |
| Links | Midnight, underlined | Sea Mist, underlined |
| Focus ring | Cerulean | Cerulean |
| Main button | Sea Green, Midnight text | The same |
| Delete button | Raspberry, white text | The same |
| Late and overdue | Raspberry tag, white text | The same |
| Messages | Midnight, white text, Sea Green action | The same |
| Small green, gold or coral text | `#047A5B`, `#8A5D00`, `#B3452A` | `#51E2BC`, `#FFD47D`, `#F9AE97` |

| Stage | Color | | Status | Color |
|---|---|---|---|---|
| New | Sea Green | | Lead | Coral |
| Qualified | Marigold | | Qualified | Marigold |
| Proposal | Coral | | Customer | Sea Green |
| Negotiation | Cerulean | | | |
| Won | Midnight, or Sea Mist in dark mode | | | |
| Lost | `#6B818A` | | | |

- A stage or status is a colored dot with its name in the text color, except in the pipeline's column blocks and the funnel, which are filled with the stage's color. Their text is Midnight, or white on Cerulean and Midnight. Lost's column block is Sea Mist `#CDD8DB` with Midnight text, because no text is readable enough on Lost's gray-blue. In dark mode, where Sea Mist is Won's, Lost's block is Midnight with Sea Mist text. The name is always there: Marigold and Coral are too close to tell apart by color alone.
- Charts: one scale each, hairline grid, no gradients, labels in the text color. Sea Green, Marigold and Coral are under 3 to 1 against white, so in light mode a thin line in one of them uses its darker shade, and a bar in one has its value beside it. Against black all five brand colors are above 5 to 1, so dark mode's lines use them as they are. Each chart has a tooltip, which the keyboard can reach too, and a table view of its figures.
- No border on one edge of a panel, and no line across the top of a page. Gradients are avoided.
- Shadows are soft and few: on a card being dragged, on dialogs and on menus. In dark mode they're black.
- Words are short and plain, with no exclamation marks. Buttons say what they do: "Add deal", "Log activity", "Delete contact".

### Chosen look

Mockup D, Stream with blocks: `docs/mockups/d-stream-blocks.html`, with `d-stream-blocks-dashboard.png` and `d-stream-blocks-pipeline.png` beside it. It's the reference for how the dashboard and pipeline look. Where it and this spec differ, this spec is right: for example, overdue follow-ups show their date, which mockup D doesn't. Dark mode has no mockup: it's mockup D in the dark colors above, and `docs/changes/dark-mode/` has screenshots of the dashboard and the pipeline in both modes.

## Not built yet

- Sign-in, user accounts, several people sharing the same data, and a record of who did what
- Making Accountable available beyond the computer it runs on
- A layout for phones
- Following the device's own dark mode setting
- AI features
- Email, calendar or phone integrations
- Currencies other than US dollars
- Reports beyond the dashboard
- Tags or custom fields
- Changing the pipeline stages
- Recording why a deal was lost
- Importing or exporting data
