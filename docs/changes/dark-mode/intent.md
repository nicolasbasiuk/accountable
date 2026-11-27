# Intent: dark mode

## Problem

Accountable only has a light mode, and some people prefer a dark screen.

## Proposed outcome

A dark mode with a toggle on every page, across every section.

## Constraints

- Light mode stays the default, and the app remembers the choice.
- Light mode looks exactly as it does today, apart from the toggle.
- Colors stay in one place, as tokens, with no scattered overrides.
- Text in dark mode meets the same contrast rules as spec.md.
- Charts, dialogs and messages follow the mode too.
- No new dependencies unless the plan makes the case for one.
- The choice is remembered in the browser, in localStorage, with no backend change. It's applied before the first paint, so light mode never flashes. A different browser starts in light.
- Dark mode uses the brand skill's surfaces: page `#04232E`, black panels and cards, Sea Mist ink.
- In dark mode, Won is Sea Mist `#CDD8DB` with Midnight text, because Midnight almost vanishes on the dark page and cards. Lost's column block gets its own dark-mode color, so Won and Lost never look the same.

## Not in this change

- Following the device's own dark mode setting.
- A layout for phones.

## Success criteria

1. npm run check passes.
2. A new end-to-end test proves that the toggle works and is remembered after a reload.
3. Screenshots of the dashboard and the pipeline in both modes are saved in docs/changes/dark-mode/.
4. Light mode is proved unchanged by a one-off comparison: every section is screenshotted in light mode before and after the change, with a fixed date, and compared pixel by pixel, ignoring the toggle. The result is saved as evidence in docs/changes/dark-mode/, with no permanent test added.
