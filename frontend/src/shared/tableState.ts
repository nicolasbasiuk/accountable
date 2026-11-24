// A table's search, sort and filter, kept in the address so they're still there after going back (G2).
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

export type TableState = { search: string; sort: string; descending: boolean; filter: string }

/** What an address may hold. Anything else in it counts as not there. */
export type TableRules = { columns: string[]; filters: string[]; sort: string; descending: boolean }

export function fromAddress(params: URLSearchParams, rules: TableRules): TableState {
  const sort = params.get('sort') ?? ''
  const column = sort.replace(/^-/, '')
  const known = rules.columns.includes(column)
  const filter = params.get('filter') ?? ''
  return {
    search: params.get('search') ?? '',
    sort: known ? column : rules.sort,
    descending: known ? sort.startsWith('-') : rules.descending,
    filter: rules.filters.includes(filter) ? filter : '',
  }
}

/** Leaves out what's as usual, so a plain list has a plain address. */
export function toAddress(state: TableState, rules: TableRules): URLSearchParams {
  const params = new URLSearchParams()
  if (state.search) params.set('search', state.search)
  if (state.filter) params.set('filter', state.filter)
  if (state.sort !== rules.sort || state.descending !== rules.descending) {
    params.set('sort', `${state.descending ? '-' : ''}${state.sort}`)
  }
  return params
}

/** The state changes at once, so typing is never held up, and the address follows. */
export function useTableState(rules: TableRules): [TableState, (change: Partial<TableState>) => void] {
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState(() => fromAddress(params, rules))
  const written = useRef<string | null>(null)

  useEffect(() => {
    if (written.current === null) {
      // Not our doing: the sidebar's link, or going back.
      setState(fromAddress(params, rules))
    } else if (params.toString() === written.current) {
      written.current = null
    }
    // The rules are the same for the life of a table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  function change(part: Partial<TableState>) {
    const next = { ...state, ...part }
    const address = toAddress(next, rules)
    setState(next)
    if (address.toString() === params.toString() && written.current === null) return
    written.current = address.toString()
    setParams(address, { replace: true })
  }

  return [state, change]
}
