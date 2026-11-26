import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type FilterFn,
  type SortFn,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Pencil, Search, Trash2 } from 'lucide-react'
import { useId, useMemo, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button, IconButton } from './buttons'
import { plural } from './format'
import { Panel } from './panels'
import { EmptyState } from './states'
import { useTableState, type TableRules } from './tableState'

type Row = { id: number; name: string }

export type Column<T> = {
  id: string
  heading: string
  /** What it sorts by. Blanks (null or undefined) always come last. */
  value: (row: T) => string | number | null | undefined
  /** What it shows, if that isn't the value. */
  cell?: (row: T) => ReactNode
  /** The order of its values, such as the stages, if that isn't their own. */
  order?: readonly string[]
  /** Numbers and dates: in the number font, and numbers at the right. */
  look?: 'number' | 'date'
  width?: string
}

/** Buttons that show only the rows with one value in a column, each with its count. */
export type Filter = { label: string; column: string; options: { value: string; label: string }[] }

type Props<T extends Row> = {
  /** What a row is, such as "contact". */
  what: string
  rows: T[]
  columns: Column<T>[]
  sort: string
  descending?: boolean
  /** The texts a search looks in (T2). */
  searched: (row: T) => (string | null | undefined)[]
  filter?: Filter
  path: (row: T) => string
  empty: ReactNode
  addButton: ReactNode
  onEdit: (row: T) => void
  onDelete: (row: T) => void
}

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
})

type Features = typeof features

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

function sortFn<T extends Row>(order?: readonly string[]): SortFn<Features, T> {
  return (a, b, column) => {
    const [one, other] = [a.getValue(column), b.getValue(column)]
    if (order) return order.indexOf(String(one)) - order.indexOf(String(other))
    if (typeof one === 'number' && typeof other === 'number') return one - other
    return collator.compare(String(one), String(other))
  }
}

const blankAsUndefined = (value: string | number | null | undefined) =>
  value === null || value === '' ? undefined : value

export function DataTable<T extends Row>(props: Props<T>) {
  const { what, rows, columns, searched, filter, path, empty, addButton, onEdit, onDelete } = props
  const navigate = useNavigate()
  const searchId = useId()

  const rules: TableRules = {
    columns: columns.map(({ id }) => id),
    filters: filter?.options.map(({ value }) => value) ?? [],
    sort: props.sort,
    descending: props.descending ?? false,
  }
  const [state, change] = useTableState(rules)

  const definitions = useMemo(
    () =>
      columns.map((column): ColumnDef<Features, T> => ({
        id: column.id,
        accessorFn: (row) => blankAsUndefined(column.value(row)),
        sortFn: sortFn<T>(column.order),
        sortUndefined: 'last',
        sortDescFirst: false,
        filterFn: (row, id, chosen) => row.getValue(id) === chosen,
      })),
    [columns],
  )

  const search = state.search.trim().toLowerCase()
  const searchFn: FilterFn<Features, T> = useMemo(
    () => (row, _column, text) => searched(row.original).some((value) => value?.toLowerCase().includes(text)),
    [searched],
  )

  const table = useTable({
    features,
    data: rows,
    columns: definitions,
    getRowId: (row) => String(row.id),
    globalFilterFn: searchFn,
    getColumnCanGlobalFilter: () => true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    state: {
      sorting: [{ id: state.sort, desc: state.descending }],
      globalFilter: search,
      columnFilters: filter && state.filter ? [{ id: filter.column, value: state.filter }] : [],
    },
    onSortingChange: (update) => {
      const [sort] = typeof update === 'function' ? update(table.state.sorting) : update
      if (sort) change({ sort: sort.id, descending: sort.desc })
    },
  })

  const shown = table.getRowModel().rows
  const counts: Map<string, number> = filter ? table.getColumn(filter.column)!.getFacetedUniqueValues() : new Map()
  const all = [...counts.values()].reduce((total, count) => total + count, 0)

  function openRow(event: MouseEvent, row: T) {
    const onControl = (event.target as Element).closest('a, button, input')
    if (onControl || window.getSelection()?.toString()) return
    void navigate(path(row))
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-4">
        <div className="relative w-80">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
          />
          <input
            id={searchId}
            type="search"
            aria-label={`Search ${what}s`}
            placeholder="Search"
            value={state.search}
            onChange={(event) => change({ search: event.target.value })}
            className="h-11 w-full rounded-control bg-white pr-3 pl-10.5 placeholder:text-muted"
          />
        </div>
        {filter && (
          <div role="group" aria-label={filter.label} className="flex gap-1 rounded-control bg-wash p-1">
            {[{ value: '', label: 'All' }, ...filter.options].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={state.filter === value}
                onClick={() => change({ filter: value })}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-tag px-3.5 font-medium text-muted hover:text-ink aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-ink"
              >
                {label} <span className="num text-sm">{value ? (counts.get(value) ?? 0) : all}</span>
              </button>
            ))}
          </div>
        )}
        <p role="status" className="text-muted">
          <span className="num text-sm">
            {shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`}
          </span>{' '}
          {plural(rows.length, what).replace(/^\d+ /, '')}
        </p>
        <div className="ml-auto">{addButton}</div>
      </div>

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState action={addButton}>{empty}</EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState action={<Button onClick={() => change({ search: '', filter: '' })}>Show all {what}s</Button>}>
            No {what}s match.
          </EmptyState>
        ) : (
          <div className="min-h-0 overflow-y-auto">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <thead>
                <tr>
                  {table.getHeaderGroups()[0]!.headers.map((header, index) => {
                    const { heading, look, width } = columns[index]!
                    const sorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : 'none'}
                        style={{ width }}
                        className="sticky top-0 z-10 bg-white px-2 pt-3 pb-2 text-left first:pl-6"
                      >
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`flex w-full cursor-pointer items-center gap-1 text-left text-sm font-medium hover:text-ink ${look === 'number' ? 'justify-end text-right' : ''} ${sorted ? 'text-ink' : 'text-muted'}`}
                        >
                          {heading}
                          {sorted === 'asc' && <ArrowUp size={14} aria-hidden />}
                          {sorted === 'desc' && <ArrowDown size={14} aria-hidden />}
                        </button>
                      </th>
                    )
                  })}
                  <th scope="col" className="sticky top-0 z-10 w-22 bg-white pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id} onClick={(event) => openRow(event, row.original)} className="group cursor-pointer">
                    {row.getAllCells().map((cell, index) => {
                      const { cell: show, value, look } = columns[index]!
                      return (
                        <td
                          key={cell.id}
                          className={`border-t border-hair px-2 py-2.5 wrap-anywhere group-hover:bg-page first:pl-6 ${look ? 'num text-[13.5px]' : ''} ${look === 'number' ? 'text-right' : ''}`}
                        >
                          {show ? show(row.original) : value(row.original)}
                        </td>
                      )
                    })}
                    <td className="border-t border-hair pr-4 group-hover:bg-page">
                      <div className="flex justify-end">
                        <IconButton label={`Edit ${row.original.name}`} onClick={() => onEdit(row.original)}>
                          <Pencil size={16} aria-hidden />
                        </IconButton>
                        <IconButton label={`Delete ${row.original.name}`} onClick={() => onDelete(row.original)}>
                          <Trash2 size={16} aria-hidden />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
