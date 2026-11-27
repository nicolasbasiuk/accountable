# Light check

Success criterion 4: light mode looks exactly as it did before dark mode, apart from the switch.

## Result

No pixel differs on any of the 12 screens and states.

| Screen or state | Pixels that differ |
|---|---|
| Dashboard `/` | 0 |
| Organizations `/organizations` | 0 |
| An organization `/organizations/1` | 0 |
| Contacts `/contacts` | 0 |
| A contact `/contacts/1` | 0 |
| Deals `/deals` | 0 |
| A deal `/deals/1` | 0 |
| Pipeline `/pipeline` | 0 |
| Not found `/nowhere` | 0 |
| The deal form, then its stage menu | 0 |
| The dashboard with a chart's table and a tooltip | 0 |
| A delete question, then the message after it | 0 |

## How it was run

- Before any code changed, full-page screenshots at 1440 by 900 in Chrome, with Playwright's `toHaveScreenshot`: no tolerance (`threshold: 0`, `maxDiffPixels: 0`), animations off, caret hidden.
- One database, loaded once with the sample data for Nov 24, 2026, and copied fresh for every run, so each run shows the same rows and times.
- Run twice on the old code first: the two runs matched pixel for pixel, so the method itself adds no noise.
- The switch and its words are hidden from the first frame with `visibility: hidden`, which keeps their place, so everything else is compared as it is.
- Run again after phases 1, 2 and 3. The last run, on the finished code, is the result above.
- To check the check: a panel one shade off white (`#fffffe`) made 819,271 pixels differ.

## Found on the way

In phase 2, Chrome drew 5 to 11 edge pixels of the tables' icons and status dots a few color levels differently (1 to 22 out of 255) when certain content was added to the sidebar, even while hidden. A moon icon beside the words did it, and so did the switch placed right under the sections. Bisected:

| In the sidebar | Pixels that differ |
|---|---|
| An empty box the switch's size | 0 |
| The words alone, or the switch alone, under the sections | 0 |
| The moon icon alone, under the sections | 6 |
| The words and the switch, under the sections | 5 |
| The words and the switch, at the foot | 0 |

So the switch sits at the foot of the sidebar, as the spec says, without an icon.

The temporary files that took the screenshots, and the screenshots themselves, were deleted after this run, as the plan says.
