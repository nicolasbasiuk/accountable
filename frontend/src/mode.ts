import { useSyncExternalStore } from 'react'

export type Mode = 'light' | 'dark'

// The script at the top of index.html reads the same key, before the page is drawn.
const KEY = 'accountable-mode'

const listeners = new Set<() => void>()

/** The chosen mode: light unless dark was chosen, also when the browser refuses storage (G10). */
export function storedMode(): Mode {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** The mode on screen. Light is the page without a mark, so it stays exactly as it was. */
function shownMode(): Mode {
  return document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light'
}

function show(mode: Mode) {
  if (mode === 'dark') document.documentElement.dataset.mode = 'dark'
  else delete document.documentElement.dataset.mode
  for (const listener of listeners) listener()
}

/** Shows the mode and keeps it. If the browser refuses storage, it's shown until the page closes. */
export function setMode(mode: Mode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Not kept, but still worth showing.
  }
  show(mode)
}

/** Switches when another tab does. Returns how to stop. */
export function followOtherTabs(): () => void {
  const changed = (event: StorageEvent) => {
    // A null key means the storage was cleared.
    if (event.key === KEY || event.key === null) show(storedMode())
  }
  window.addEventListener('storage', changed)
  return () => window.removeEventListener('storage', changed)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMode(): Mode {
  return useSyncExternalStore(subscribe, shownMode)
}
