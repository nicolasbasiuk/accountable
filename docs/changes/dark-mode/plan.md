# Plan: dark mode

How to build what `docs/changes/dark-mode/intent.md` asks for, as `docs/spec.md` now describes it. Codes such as G10 are the spec's requirements. The brand skill applies to all UI work. If building shows that `docs/spec.md` is wrong, stop and ask.

The idea in one line: today's tokens in `styles.css` are split into two kinds. **Color-named** tokens (`white`, `midnight`, `sea-mist`, the five brand colors) never change. **Role-named** tokens (`page`, `ink`, `panel` and the rest) get a second value under `:root[data-mode='dark']`. Screens use only tokens, so they follow the mode without knowing about it.

## Files that change

No backend change and no new dependency. Base UI, already installed, has the switch.

### `frontend/`

| File | Change |
|---|---|
| `index.html` | A small classic script at the top of `<head>` that reads the stored choice and sets `data-mode="dark"` on `<html>` before anything is drawn. It catches a refused storage and stays light |
| `src/styles.css` | Renames `green-dark`, `gold-dark` and `coral-dark` to `green-text`, `gold-text` and `coral-text`. New role tokens: `panel`, `raised` (menus and tooltips), `won`, `on-won`, `lost-block`, `on-lost-block`, `green-line` (the chart's line, its dots and checkboxes) and `shadow`. The link underline is made from `ink`. Two constant tokens, `sea-green-hover` and `raspberry-hover`, for the hovers now written as hex in `buttons.tsx`. Then the dark block: every role token's dark value, and `color-scheme: dark` so native controls such as date fields turn dark too |
| `src/mode.ts` (new) | The mode: read it (light unless `dark` is stored), set it (store it, mark `<html>`), follow other tabs through the `storage` event, and `useMode()` for React |
| `src/Frame.tsx` | The sidebar becomes a column, with the Dark mode switch at its foot. The current section's background is `panel` |
| `src/main.tsx` | Starts following other tabs, beside `refetchOnFocus()` |
| `src/deals/stages.ts` | Won uses `won` and `on-won`; Lost's block uses `lost-block` and `on-lost-block` |
| `src/deals/DealPage.tsx`, `src/pipeline/PipelineCard.tsx`, `src/shared/panels.tsx`, `states.tsx`, `dialogs.tsx`, `DataTable.tsx` | `bg-white` used as a surface becomes `bg-panel` |
| `src/shared/fields.tsx`, `src/dashboard/ChartPanel.tsx` | Menus and tooltips use `raised`; the chosen part of a segmented field uses `panel`; error text uses `coral-text` |
| `src/shared/FormDialog.tsx`, `ConfirmDelete.tsx` | `coral-dark` becomes `coral-text` |
| `src/shared/buttons.tsx` | The two hex hovers become `sea-green-hover` and `raspberry-hover` |
| `src/pipeline/PipelineColumn.tsx` | Won's Add button is made from `on-won` at the same strength as today, so it shows on Midnight and on Sea Mist |
| `src/dashboard/FunnelRibbon.tsx`, `MonthCharts.tsx`, `OpenDeals.tsx` | SVG white becomes `panel`; the line and its dots use `green-line`; the pale part of each bar is mixed with `panel` instead of white |
| `src/mode.test.ts`, `src/tokens.test.ts` (new) | The unit tests under Proof |

Not changed: `src/shared/Messages.tsx`, which stays Midnight in both modes, and the dialog backdrop, which stays Midnight at 40%.

### `e2e/` and `docs/`

| File | Change |
|---|---|
| `e2e/support.ts` | `inDarkMode(page)`: stores the choice before the page loads, for tests that start in dark mode |
| `e2e/mode.spec.ts` (new) | The end-to-end tests under Proof |
| `e2e/quality.spec.ts` | The accessibility checks run in both modes |
| `docs/changes/dark-mode/` | `screenshots/` with `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png`, `pipeline-dark.png` (criterion 3), and `light-check.md` (criterion 4). The screenshots are committed, as a record of the change; the light check's own images are not |
| `docs/STATUS.md` | What's done. Also the test time in `AGENTS.md` if it changes by a minute or more |

Two temporary files, `e2e/light-check.ts` and `e2e/light-check.config.ts`, take the light screenshots for criterion 4, into `.light-check/` at the repo root. That folder ignores itself with its own `.gitignore`, so the screenshots can't be committed. None of the three is committed: phase 4 deletes them. The name doesn't end in `.spec.ts`, so `npm test` never picks it up.

## Order of work

Five phases. Each one ends with its tests passing and the app starting. A phase starts only when the one before is done. Nobody commits but the user.

### 0. Light baseline, before any code changes

1. Write the temporary light check. It takes a full-page screenshot at 1440 by 900 of every screen in `quality.spec.ts`'s list, the deal form, the stage menu and a delete question. It uses Playwright's own `toHaveScreenshot` with no tolerance, animations off and the caret hidden. Its images are kept in `.light-check/`, which git ignores.
2. It hides the switch and its words in every run, through a style that matches nothing before the switch exists, so the switch is the only thing left out.
3. Seed one database for Nov 24, 2026, once, and start each run from a copy of it, so every run shows the same rows and times.
4. Run it twice on today's code.

**Done when:** the two runs match pixel for pixel. If they don't, find what changes between runs and fix that first.

### 1. Role tokens, with light mode unchanged

1. In `styles.css`, the renames and new tokens from the table, each with exactly today's light value. No dark values yet.
2. Go through every use of `white`, `midnight`, `sea-mist` and the `-dark` tokens in `src/`. Each is either a surface (`panel` or `raised`), a stage's look (`won`, `lost-block`), or white text on a color, which stays `white`.
3. Look at the built CSS: every role token must be used through `var()`, the shadow included, and none may be dropped as unused.
4. `tokens.test.ts`, part 3, and part 2 in light mode. Part 1 and dark mode's half of part 2 need the dark values, so they come in phase 3.

**Done when:** `npm run check` passes and the light check shows no pixel changed.

### 2. The switch and remembering the choice

1. `mode.ts`, and the script in `index.html`. Both use the key `accountable-mode`, and each names the other in a short comment.
2. The switch in `Frame.tsx`: Base UI's Switch, with the words "Dark mode", in the sidebar items' muted text. The page keeps its place when the switch is added. No icon: a moon icon changed 5 to 11 anti-aliased pixels of the tables' own icons in light mode (see Risks).
3. `mode.test.ts`, and `mode.spec.ts` tests 1, 3, 4, 5 and 6. With no dark values yet, they check the switch and `data-mode`, not colors.

**Done when:** those tests pass and the light check shows no pixel changed, with the switch hidden.

### 3. Dark values

1. The dark block in `styles.css`, with the values in the spec's Look. For the two the spec leaves out: `wash` sits between the page and Midnight, about `#062F3D`, so it shows on black panels, the page and Midnight menus; `hair` is about `#163A46`. `tokens.test.ts` part 2 decides the final values.
2. Every screen, dialog, menu, picker, tooltip, message, held card and chart table in dark mode at 1440 by 900, beside the brand skill. Check the Won and Lost blocks and their Add buttons, the funnel's Won band and share labels, the line chart, and the date fields. Anything that doesn't follow is fixed in a token, never in a screen.
3. The rest of `mode.spec.ts` and `tokens.test.ts`, and the dark runs in `quality.spec.ts`.

**Done when:** `npm test` passes and every screen looks right in dark mode at 1280 by 720, 1440 by 900 and 1920 by 1080.

### 4. Evidence and wrap-up

1. Run the light check one last time. Write `light-check.md`: each screen, the number of pixels that differ, and how it was run. Delete the two temporary files and `.light-check/`.
2. Take the four screenshots for criterion 3 at 1440 by 900, with the tests' database and date.
3. `docs/STATUS.md`.
4. `npm run check`.

**Done when:** success criteria 1 to 4 are met.

## Risks

The riskiest step is phase 1: it touches almost every screen, and the intent says light mode can't change at all. That's why it comes before any dark value, with a pixel check on each side of it.

| Risk | What it would break | What we do |
|---|---|---|
| Splitting a token changes a light color by a shade | Criterion 4 | Light values copied exactly; phase 1 adds no dark values; the light check after phases 1, 2 and 4 |
| Tailwind 4 copies some theme values into its classes instead of using the variable, or drops a variable it thinks is unused. Today's build confirms it for the shadow: `shadow-lifted` holds `#073b4c29` itself, while colors such as `bg-white` use `var()` | A dark value that has no effect | Phase 1, step 3. The shadow takes its color from the `shadow` variable |
| The page draws before the mode is set | A flash of light mode (G10) | A classic script in `<head>`, which runs before the body exists; `mode.spec.ts` test 5 |
| The browser refuses storage | A console error (Q5), or no app at all | Both readers catch it and stay light; `mode.test.ts` test 4 |
| Native controls stay light | White date fields and checkboxes in dark mode | `color-scheme: dark` in the dark block only, so light is untouched |
| A surface still uses `white`, or a Recharts default color shows | A white patch in dark mode | `mode.spec.ts` test 7 on every screen, `tokens.test.ts` part 3, phase 3 step 2 |
| Contrast that axe can't see: SVG text, highlighted menu items, hovers | Q3 in dark mode | `tokens.test.ts` part 2 checks the pairs from the tokens themselves |
| The light screenshots differ between runs for reasons other than code | A light check that can't be trusted | Phase 0 runs it twice on today's code first, with one database and fixed date |
| Chrome anti-aliases the tables' icons and dots a few levels differently when unrelated content is added elsewhere, even hidden. Found in phase 2: a moon icon, or the switch under the sections, changed 5 to 11 pixels; the switch at the foot without an icon changed none | Criterion 4's exact match | The switch has no icon. The light check hides the switch from the first frame. Any later change that brings it back is bisected the same way |
| The names `green-dark` and the others would hold light colors in dark mode | Confusing code | Renamed to `-text`, for what they're used for |
| Midnight messages and menus stand out less on the dark page (1.35 to 1) | Someone misses an Undo | Accepted in the spec; looked at in phase 3, step 2 |
| The dark accessibility runs lengthen `npm test` | Slower checks | About a minute more; `AGENTS.md` and `docs/STATUS.md` updated if it's more |

What this could break today: light mode on every screen (the light check), and the length of `npm test`. Nothing in the backend, the data or the commands.

Decided against:

- **`dark:` classes in the screens:** they spread the mode across every file, which the intent rules out.
- **A theme library:** a new dependency for about 30 lines of code.
- **The choice on the server:** the intent keeps it in the browser.
- **Following the device's setting:** out of scope; light is the default.
- **Colors passed through React:** the charts already read CSS variables, so CSS does the switching.
- **A permanent screenshot test:** the intent asks for a one-off check.
- **Dark Sea Mist messages:** they'd need their own action and icon colors. Midnight works on both pages.

## Proof

`npm test` runs everything below except "By hand". The codes are what each test proves.

### Frontend unit tests (Vitest, beside the code)

`mode.test.ts`
1. Light when nothing is stored, or when what's stored isn't `dark` (G10).
2. Turning dark mode on stores it and marks the page; turning it off stores light and removes the mark (G10).
3. A change in another tab, through the `storage` event, switches this one and tells what's listening (G10).
4. When the browser refuses storage, it stays light and nothing throws (G10, Q5).

`tokens.test.ts`
1. Every role token has a light and a dark value, and no color-named token has a dark one.
2. In both modes, text and secondary text reach 4.5 on the page, panels, menus and `wash`; small green, gold and coral text on the page and panels; and the text on every stage fill and block. The only exception is white on Cerulean and Raspberry (Q3).
3. No file in `src/` except `styles.css` has a color written out (hex, `rgb`, `hsl`) or a `dark:` class.

### End-to-end tests (Playwright, `e2e/`)

`mode.spec.ts`
1. A fresh browser starts light, with the Dark mode switch off, on every section (G10).
2. Turning it on darkens the page, a panel, the text, a card and the Won column block at once, with `color-scheme` dark. It's still dark after a reload and on another section. Turning it off goes back, also after a reload (G10, criterion 2).
3. With the keyboard: Tab reaches the switch with its focus visible, and Space turns it on and off (Q2).
4. A second tab switches when the first does (G10).
5. With dark stored, `<html>` is already dark when the body first appears (G10).
6. A new browser starts light, whatever another one chose (G10).
7. In dark mode, nothing on any screen, form, menu, picker, chart tooltip or message has a white background or a white SVG fill (G10, Look).

`quality.spec.ts`
1. The accessibility check (axe) in dark mode too: every screen, the charts' tables, each form with problems, the pickers, both questions, a message and a held card (Q2, Q3).

### By hand

1. The light check, before and after: no pixel changed outside the switch (criterion 4, in `light-check.md`).
2. The dashboard and the pipeline in both modes, saved in `docs/changes/dark-mode/screenshots/` (criterion 3).
3. Every screen in dark mode at the three sizes, beside the brand skill.
4. `npm run check` passes (criterion 1).
