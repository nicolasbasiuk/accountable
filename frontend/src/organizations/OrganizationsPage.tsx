import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { AddButton } from '../shared/buttons'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { DataTable, type Column } from '../shared/DataTable'
import { money } from '../shared/format'
import { Page } from '../shared/panels'
import { Loaded } from '../shared/states'
import { OrganizationForm } from './OrganizationForm'
import { organizationsQuery, type Organization } from './queries'
import { websiteLink } from './website'

const path = ({ id }: Organization) => `/organizations/${id}`

const columns: Column<Organization>[] = [
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
  { id: 'industry', heading: 'Industry', value: (row) => row.industry, width: '19%' },
  {
    id: 'website',
    heading: 'Website',
    value: (row) => row.website,
    cell: (row) =>
      row.website && (
        <a href={websiteLink(row.website)} target="_blank" rel="noreferrer" className="link">
          {row.website}
        </a>
      ),
    width: '21%',
  },
  { id: 'contacts', heading: 'Contacts', value: (row) => row.contacts, look: 'number', width: '96px' },
  { id: 'open_deals', heading: 'Open deals', value: (row) => row.open_deals, look: 'number', width: '112px' },
  {
    id: 'open_value',
    heading: 'Open value',
    value: (row) => row.open_value,
    cell: (row) => money(row.open_value),
    look: 'number',
    width: '124px',
  },
]

const searched = (row: Organization) => [row.name, row.industry, row.website]

type Open = { what: 'add' } | { what: 'edit' | 'delete'; row: Organization }

export function OrganizationsPage() {
  const [open, setOpen] = useState<Open | null>(null)
  const query = useQuery(organizationsQuery)
  const close = () => setOpen(null)
  return (
    <Page title="Organizations" fill>
      <Loaded query={query}>
        {(rows) => (
          <DataTable
            what="organization"
            rows={rows}
            columns={columns}
            sort="name"
            searched={searched}
            path={path}
            empty="The companies you do business with go here."
            addButton={<AddButton onClick={() => setOpen({ what: 'add' })}>Add organization</AddButton>}
            onEdit={(row) => setOpen({ what: 'edit', row })}
            onDelete={(row) => setOpen({ what: 'delete', row })}
          />
        )}
      </Loaded>
      {open?.what === 'add' && <OrganizationForm onClosed={close} />}
      {open?.what === 'edit' && <OrganizationForm organization={open.row} onClosed={close} />}
      {open?.what === 'delete' && (
        <ConfirmDelete what="organization" name={open.row.name} path={path(open.row)} onClosed={close} />
      )}
    </Page>
  )
}
