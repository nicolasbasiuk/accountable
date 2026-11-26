import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DealForm } from '../deals/DealForm'
import { LinkedDeals } from '../deals/LinkedDeals'
import { Button } from '../shared/buttons'
import { recordId } from '../shared/checks'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { Details, HeadedPanel, Page, RecordColumns } from '../shared/panels'
import { Loaded, NotFound } from '../shared/states'
import { Timeline } from '../timeline/Timeline'
import { ContactForm } from './ContactForm'
import { EmailLink } from './EmailLink'
import { contactQuery, type ContactDetails } from './queries'
import { StatusName } from './StatusName'

const missing = <NotFound what="This contact no longer exists" listName="Contacts" listPath="/contacts" />

export function ContactPage() {
  const id = recordId(useParams().id)
  return id ? <Existing key={id} id={id} /> : missing
}

function Existing({ id }: { id: number }) {
  const query = useQuery(contactQuery(id))
  return (
    <Loaded query={query} missing={missing}>
      {(contact) => <Shown contact={contact} />}
    </Loaded>
  )
}

function Shown({ contact }: { contact: ContactDetails }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState<'edit' | 'delete' | 'deal' | null>(null)
  const close = () => setOpen(null)
  const { id, name, email, phone, organization } = contact
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
              className="[&_dl]:mt-3"
            >
              <Details
                fields={[
                  ['Status', <StatusName status={contact.status} />],
                  [
                    'Organization',
                    organization && (
                      <Link to={`/organizations/${organization.id}`} className="link">
                        {organization.name}
                      </Link>
                    ),
                  ],
                  ['Job title', contact.job_title],
                  ['Email', email && <EmailLink email={email} />],
                  [
                    'Phone',
                    phone && (
                      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="link num text-sm">
                        {phone}
                      </a>
                    ),
                  ],
                ]}
              />
            </HeadedPanel>
            <LinkedDeals deals={contact.deals} onAdd={() => setOpen('deal')} />
          </>
        }
      >
        <Timeline area="contacts" id={id} on={{ contact_id: id }} />
      </RecordColumns>
      {open === 'edit' && <ContactForm contact={contact} onClosed={close} />}
      {open === 'deal' && (
        <DealForm preset={{ contact_id: id, organization_id: organization?.id ?? null }} onClosed={close} />
      )}
      {open === 'delete' && (
        <ConfirmDelete
          what="contact"
          name={name}
          path={`/contacts/${id}`}
          onDeleted={() => navigate('/contacts', { flushSync: true })}
          onClosed={close}
        />
      )}
    </Page>
  )
}
