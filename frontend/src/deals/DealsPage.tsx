import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { AddButton } from '../shared/buttons'
import { useConfig } from '../shared/config'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { DataTable, type Column } from '../shared/DataTable'
import { date, money, percent } from '../shared/format'
import { Page } from '../shared/panels'
import { Loaded } from '../shared/states'
import { DealForm } from './DealForm'
import { LateTag } from './LateTag'
import { dealsQuery, type Deal } from './queries'
import { StageName } from './StageName'
import { STAGE_ORDER } from './stages'

const path = ({ id }: Deal) => `/deals/${id}`

const columns: Column<Deal>[] = [
  {
    id: 'name',
    heading: 'Name',
    value: (row) => row.name,
    cell: (row) => (
      <Link to={path(row)} className="link font-semibold">
        {row.name}
      </Link>
    ),
  },
  {
    id: 'organization',
    heading: 'Organization',
    value: (row) => row.organization?.name,
    cell: (row) =>
      row.organization && (
        <Link to={`/organizations/${row.organization.id}`} className="link">
          {row.organization.name}
        </Link>
      ),
    width: '15.5%',
  },
  {
    id: 'contact',
    heading: 'Main contact',
    value: (row) => row.contact?.name,
    cell: (row) =>
      row.contact && (
        <Link to={`/contacts/${row.contact.id}`} className="link">
          {row.contact.name}
        </Link>
      ),
    width: '12.5%',
  },
  {
    id: 'stage',
    heading: 'Stage',
    value: (row) => row.stage,
    cell: (row) => <StageName stage={row.stage} />,
    order: STAGE_ORDER,
    width: '118px',
  },
  {
    id: 'value',
    heading: 'Value',
    value: (row) => row.value,
    cell: (row) => money(row.value),
    look: 'number',
    width: '88px',
  },
  {
    id: 'probability',
    heading: 'Probability',
    value: (row) => row.probability,
    cell: (row) => percent(row.probability),
    look: 'number',
    width: '94px',
  },
  {
    id: 'expected',
    heading: 'Expected revenue',
    value: (row) => row.expected_revenue,
    cell: (row) => money(row.expected_revenue),
    look: 'number',
    width: '92px',
  },
  {
    id: 'close_date',
    heading: 'Close date',
    value: (row) => row.close_date,
    cell: (row) => (
      <>
        {date(row.close_date)}
        {row.days_late > 0 && (
          <span className="mt-1 block font-sans">
            <LateTag days={row.days_late} />
          </span>
        )}
      </>
    ),
    look: 'date',
    width: '118px',
  },
]

type Open = { what: 'add' } | { what: 'edit' | 'delete'; row: Deal }

export function DealsPage() {
  const [open, setOpen] = useState<Open | null>(null)
  const query = useQuery(dealsQuery)
  const { stages } = useConfig()
  const searched = useCallback(
    (row: Deal) => [
      row.name,
      row.organization?.name,
      row.contact?.name,
      stages.find(({ key }) => key === row.stage)?.name,
    ],
    [stages],
  )
  const close = () => setOpen(null)
  return (
    <Page title="Deals" fill>
      <Loaded query={query}>
        {(rows) => (
          <DataTable
            what="deal"
            rows={rows}
            columns={columns}
            sort="close_date"
            descending
            searched={searched}
            path={path}
            empty="The sales you hope to make go here."
            addButton={<AddButton onClick={() => setOpen({ what: 'add' })}>Add deal</AddButton>}
            onEdit={(row) => setOpen({ what: 'edit', row })}
            onDelete={(row) => setOpen({ what: 'delete', row })}
          />
        )}
      </Loaded>
      {open?.what === 'add' && <DealForm onClosed={close} />}
      {open?.what === 'edit' && <DealForm deal={open.row} onClosed={close} />}
      {open?.what === 'delete' && (
        <ConfirmDelete what="deal" name={open.row.name} path={path(open.row)} onClosed={close} />
      )}
    </Page>
  )
}
