// What a screen shows when there's nothing, or something went wrong (G4, G5).
import { notifyManager, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import { explain, isNotFound } from './client'
import { Button } from './buttons'

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center text-muted">
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Everything on screen is asked for again, because it all comes from the same server. */
function TryAgain() {
  const client = useQueryClient()
  return <Button onClick={() => void client.refetchQueries({ type: 'active' })}>Try again</Button>
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div role="alert" className="m-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <CircleAlert size={28} aria-hidden className="text-raspberry" />
      <p className="text-lg font-semibold">{explain(error)}</p>
      <p className="text-muted">Check that Accountable is still running, then try again.</p>
      <TryAgain />
    </div>
  )
}

/** Why something that's on screen couldn't be loaded again, if so. A record that has gone gets its own page instead. */
function useRefreshError(): Error | null {
  const queries = useQueryClient().getQueryCache()
  return useSyncExternalStore(
    useCallback((changed) => queries.subscribe(notifyManager.batchCalls(changed)), [queries]),
    () => {
      const failed = queries.findAll({ type: 'active' }).find(({ state }) => state.data !== undefined && state.error && !isNotFound(state.error))
      return failed?.state.error ?? null
    },
  )
}

/** Above a page that shows something it couldn't load again. */
export function OutOfDate() {
  const error = useRefreshError()
  if (!error) return null
  return (
    <div role="alert" className="mx-5 mt-5 flex items-center gap-4 rounded-control bg-white px-5 py-3">
      <CircleAlert size={20} aria-hidden className="text-raspberry" />
      <p className="flex-1">
        <span className="font-semibold">{explain(error)}</span> What you see may be out of date.
      </p>
      <TryAgain />
    </div>
  )
}

export function NotFound({ what, listName, listPath }: { what: string; listName: string; listPath: string }) {
  return (
    <main className="grid min-h-screen place-items-center p-8 text-center">
      <title>Not found - Accountable</title>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{what}</h1>
        <Link to={listPath} className="link">
          Go to {listName}
        </Link>
      </div>
    </main>
  )
}

type LoadedProps<T> = { query: UseQueryResult<T>; missing?: ReactNode; children: (data: T) => ReactNode }

/** Shows what a query loaded, or why it couldn't. */
export function Loaded<T>({ query, missing, children }: LoadedProps<T>) {
  if (missing && isNotFound(query.error)) return missing
  if (query.data !== undefined) return children(query.data)
  return query.error ? <ErrorState error={query.error} /> : null
}

/** When a screen itself fails, which no one should see. */
export function Broken() {
  return (
    <main role="alert" className="grid min-h-screen place-items-center p-8 text-center">
      <title>Something went wrong - Accountable</title>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">This screen stopped working</h1>
        <p className="text-muted">Your data is safe. Open the dashboard to carry on.</p>
        <a href="/" className="link">
          Go to the dashboard
        </a>
      </div>
    </main>
  )
}
