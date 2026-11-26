import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { AddButton } from '../shared/buttons'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { DataTable, type Column, type Filter } from '../shared/DataTable'
import { date, dayOf } from '../shared/format'
import { Page } from '../shared/panels'
import { Loaded } from '../shared/states'
import { ContactForm } from './ContactForm'
import { EmailLink } from './EmailLink'
import { contactsQuery, type Contact } from './queries'
import { STATUS_NAMES, STATUSES, StatusName } from './StatusName'

const path = ({ id }: Contact) => `/contacts/${id}`

const columns: Column<Contact>[] = [
  {
    id: 'name',
    heading: 'Name',
    value: (row) => row.name,
    cell: (row) => (
      <>
        <Link to={path(row)} className="link font-semibold">
          {row.name}
        </Link>
        {row.job_title && <span className="block text-sm text-muted">{row.job_title}</span>}
      </>
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
    width: '14%',
  },
  {
    id: 'status',
    heading: 'Status',
    value: (row) => row.status,
    cell: (row) => <StatusName status={row.status} />,
    order: STATUSES,
    width: '108px',
  },
  {
    id: 'email',
    heading: 'Email',
    value: (row) => row.email,
    cell: (row) => row.email && <EmailLink email={row.email} className="text-xs" />,
    width: '16.5%',
  },
  {
    id: 'phone',
    heading: 'Phone',
    value: (row) => row.phone,
    cell: (row) =>
      row.phone && (
        <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} className="link">
          {row.phone}
        </a>
      ),
    look: 'date',
    width: '132px',
  },
  {
    id: 'last_activity',
    heading: 'Last activity',
    value: (row) => row.last_activity,
    cell: (row) => row.last_activity && date(dayOf(row.last_activity)),
    look: 'date',
    width: '116px',
  },
  {
    id: 'next_follow_up',
    heading: 'Next follow-up',
    value: (row) => row.next_follow_up,
    cell: (row) => row.next_follow_up && date(row.next_follow_up),
    look: 'date',
    width: '118px',
  },
]

const searched = (row: Contact) => [row.name, row.job_title, row.organization?.name, row.email, row.phone]

const filter: Filter = {
  label: 'Status',
  column: 'status',
  options: STATUSES.map((status) => ({ value: status, label: STATUS_NAMES[status] })),
}

type Open = { what: 'add' } | { what: 'edit' | 'delete'; row: Contact }

export function ContactsPage() {
  const [open, setOpen] = useState<Open | null>(null)
  const query = useQuery(contactsQuery)
  const close = () => setOpen(null)
  return (
    <Page title="Contacts" fill>
      <Loaded query={query}>
        {(rows) => (
          <DataTable
            what="contact"
            rows={rows}
            columns={columns}
            sort="name"
            searched={searched}
            filter={filter}
            path={path}
            empty="The people you deal with go here, including leads and customers."
            addButton={<AddButton onClick={() => setOpen({ what: 'add' })}>Add contact</AddButton>}
            onEdit={(row) => setOpen({ what: 'edit', row })}
            onDelete={(row) => setOpen({ what: 'delete', row })}
          />
        )}
      </Loaded>
      {open?.what === 'add' && <ContactForm onClosed={close} />}
      {open?.what === 'edit' && <ContactForm contact={open.row} onClosed={close} />}
      {open?.what === 'delete' && (
        <ConfirmDelete what="contact" name={open.row.name} path={path(open.row)} onClosed={close} />
      )}
    </Page>
  )
}
