import { focusManager, MutationCache, QueryClient } from '@tanstack/react-query'
import { closeUndoMessages } from './messageStore'

/** The key of a card's move on the pipeline. Everything else refreshes as soon as it's saved. */
export const CARD_MOVE = ['card move']

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      // The server is on this computer, so being offline makes no difference.
      queries: { networkMode: 'always', retry: false },
      mutations: { networkMode: 'always' },
    },
    mutationCache: new MutationCache({
      // A change that's saved can't be followed by the Undo of an earlier move (P8).
      onSuccess: () => closeUndoMessages(),
      // Refreshes everything, so nobody has to keep a list of what affects what.
      onSettled: (_data, error, _variables, _result, mutation) => {
        if (mutation.options.mutationKey?.[0] === CARD_MOVE[0]) {
          // Only the last move refreshes, also if it fails, because earlier ones may have been saved.
          // This one still counts as running.
          if (client.isMutating({ mutationKey: CARD_MOVE }) > 1) return
        } else if (error) return
        return client.invalidateQueries()
      },
    }),
  })
  return client
}

/** Refetches when the tab is shown, as the library does, and also when the window gets the focus (G9). */
export function refetchOnFocus(): void {
  focusManager.setEventListener((onFocus) => {
    const shown = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', shown)
    document.addEventListener('visibilitychange', shown)
    return () => {
      window.removeEventListener('focus', shown)
      document.removeEventListener('visibilitychange', shown)
    }
  })
}
