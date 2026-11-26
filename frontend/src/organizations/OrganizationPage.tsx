import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ContactForm } from '../contacts/ContactForm'
import { StatusName } from '../contacts/StatusName'
import { DealForm } from '../deals/DealForm'
import { LinkedDeals } from '../deals/LinkedDeals'
import { Button } from '../shared/buttons'
import { recordId } from '../shared/checks'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { money } from '../shared/format'
import { Details, HeadedPanel, Page, RecordColumns, Row, Rows } from '../shared/panels'
import { Loaded, NotFound } from '../shared/states'
import { Timeline } from '../timeline/Timeline'
import { OrganizationForm } from './OrganizationForm'
import { organizationQuery, type OrganizationDetails } from './queries'
import { websiteLink } from './website'

const missing = (
  <NotFound what="This organization no longer exists" listName="Organizations" listPath="/organizations" />
)

export function OrganizationPage() {
  const id = recordId(useParams().id)
  return id ? <Existing key={id} id={id} /> : missing
}

function Existing({ id }: { id: number }) {
  const query = useQuery(organizationQuery(id))
  return (
    <Loaded query={query} missing={missing}>
      {(organization) => <Shown organization={organization} />}
    </Loaded>
  )
}

function Shown({ organization }: { organization: OrganizationDetails }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState<'edit' | 'delete' | 'contact' | 'deal' | null>(null)
  const close = () => setOpen(null)
  const { id, name, website, contacts, deals } = organization
  return (
    <Page title={name}>
      <RecordColumns
        side={
          <>
            <HeadedPanel
              heading="Details"
              action={
                <div className="flex gap-2">
                  <Button onClick={() => setOpen('edit')}>Edit</Button>
                  <Button onClick={() => setOpen('delete')}>Delete</Button>
                </div>
              }
            >
              <dl className="mt-3 mb-5 grid grid-cols-2 gap-4">
                <Figure label="Open value" value={organization.open_value} />
                <Figure label="Value won" value={organization.value_won} />
              </dl>
              <Details
                fields={[
                  [
                    'Website',
                    website && (
                      <a href={websiteLink(website)} target="_blank" rel="noreferrer" className="link">
                        {website}
                      </a>
                    ),
                  ],
                  ['Industry', organization.industry],
                  ['Notes', organization.notes && <span className="whitespace-pre-line">{organization.notes}</span>],
                ]}
              />
            </HeadedPanel>
            <HeadedPanel heading="Contacts" action={<Button onClick={() => setOpen('contact')}>Add contact</Button>}>
              {contacts.length === 0 && <p className="mt-2 text-muted">The people who work here go here.</p>}
              <Rows>
                {contacts.map((contact) => (
                  <Row key={contact.id}>
                    <span className="min-w-0">
                      <Link to={`/contacts/${contact.id}`} className="link font-semibold">
                        {contact.name}
                      </Link>
                      {contact.job_title && <span className="block text-sm text-muted">{contact.job_title}</span>}
                    </span>
                    <StatusName status={contact.status} />
                  </Row>
                ))}
              </Rows>
            </HeadedPanel>
            <LinkedDeals deals={deals} onAdd={() => setOpen('deal')} />
          </>
        }
      >
        <Timeline area="organizations" id={id} />
      </RecordColumns>
      {open === 'edit' && <OrganizationForm organization={organization} onClosed={close} />}
      {open === 'contact' && <ContactForm organizationId={id} onClosed={close} />}
      {open === 'deal' && <DealForm preset={{ organization_id: id }} onClosed={close} />}
      {open === 'delete' && (
        <ConfirmDelete
          what="organization"
          name={name}
          path={`/organizations/${id}`}
          onDeleted={() => navigate('/organizations', { flushSync: true })}
          onClosed={close}
        />
      )}
    </Page>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num text-xl font-medium tracking-[-0.04em]">{money(value)}</dd>
    </div>
  )
}
