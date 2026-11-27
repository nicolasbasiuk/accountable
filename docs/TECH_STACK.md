This project will use the following high level technical stack:

1. Node.js 26, the current LTS (24 or later works) / TypeScript for the frontend, using React and Vite, in `frontend/`
2. Python 3.12 for the backend using uv, with FastAPI, in `backend/`, with `pyproject.toml` and `uv.lock` at the repo root

The frontend gets its data from the backend's JSON API. The backend keeps the data in a local SQLite database file, using SQLAlchemy Core with no raw SQL, and fills it with the sample data when the database is new.

Prefer popular, well-supported libraries to custom code, such as for the data tables, the charts and the drag-and-drop pipeline. Don't hand-roll what a mature library does well.

For now it runs locally. Later, Supabase will provide sign-in and the database, and the app will be deployed to Render.

Commands are npm scripts in a `package.json` at the repo root, with `frontend/` as an npm workspace, so they work the same on Mac, Linux and Windows:

- `npm run dev` starts the backend and the frontend together
- `npm test` runs all the tests and fails if any test fails
- `npm run seed` resets the database to the sample data
- `npm run check` runs the checks below, then `npm test`, and fails if any fails. `npm run check:quick` leaves out the end-to-end tests
- `npm run format` fixes the formatting

The checks:

1. Prettier, and ESLint with the recommended rules of ESLint, typescript-eslint and React Hooks, for the frontend
2. ruff format and ruff check, with ruff's default rules, for the backend
3. tsc for the frontend
4. gitleaks across the repo, allowing only the git-ignored `.env`

A lefthook pre-commit hook, in `lefthook.yml`, formats the staged files, then runs ESLint and ruff check on them, tsc on the whole frontend and end-to-end tests, and gitleaks on what is staged. It leaves out the tests, so it stays quick.

CI is GitHub Actions, in `.github/workflows/ci.yml`. On every push to any branch, its one job, `check`, runs gitleaks on every commit first, then `npm run check:quick`. The end-to-end tests run only on your computer, in `npm run check`.

`docs/STATUS.md` says how to run the app. `README.md` is the course's own guide, so leave it as it is.

Testing will cover:

1. Unit tests for the frontend, using Vitest
2. Unit tests for the backend, using pytest
3. End-to-end tests of the whole app in a browser, in `e2e/`, using Playwright Test (`@playwright/test`) with the installed Google Chrome. They start the app themselves, so `npm test` needs nothing else running.

The tests use a database of their own, so running them never changes your data.
