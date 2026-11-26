import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../shared/buttons'
import { recordId } from '../shared/checks'
import { stageInfo, useConfig, type Stage } from '../shared/config'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { date, money, percent } from '../shared/format'
import { Details, HeadedPanel, Page, RecordColumns } from '../shared/panels'
import { Loaded, NotFound } from '../shared/states'
import { Timeline } from '../timeline/Timeline'
import { DealForm } from './DealForm'
import { LateTag } from './LateTag'
import { dealQuery, type Deal } from './queries'
import { STAGE_LOOKS, STAGE_ORDER } from './stages'

const missing = <NotFound what="This deal no longer exists" listName="Deals" listPath="/deals" />

export function DealPage() {
  const id = recordId(useParams().id)
  return id ? <Existing key={id} id={id} /> : missing
}

function Existing({ id }: { id: number }) {
  const query = useQuery(dealQuery(id))
  return (
    <Loaded query={query} missing={missing}>
      {(deal) => <Shown deal={deal} />}
    </Loaded>
  )
}

function Shown({ deal }: { deal: Deal }) {
  const config = useConfig()
  const navigate = useNavigate()
  const [open, setOpen] = useState<'edit' | 'delete' | null>(null)
  const close = () => setOpen(null)
  const { id, name, organization, contact } = deal
  return (
    <Page title={name}>
      <StagePath stage={deal.stage} />
      <RecordColumns
        side={
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
                [
                  'Value',
                  <span className="num text-xl leading-none font-medium tracking-[-0.04em]">{money(deal.value)}</span>,
                ],
                ['Probability', <span className="num text-sm">{percent(deal.probability)}</span>],
                ['Expected revenue', <span className="num text-sm">{money(deal.expected_revenue)}</span>],
                [
                  stageInfo(config, deal.stage).open ? 'Expected close' : 'Closed',
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="num text-sm">{date(deal.close_date)}</span>
                    <LateTag days={deal.days_late} />
                  </span>,
                ],
                [
                  'Organization',
                  organization && (
                    <Link to={`/organizations/${organization.id}`} className="link">
                      {organization.name}
                    </Link>
                  ),
                ],
                [
                  'Main contact',
                  contact && (
                    <Link to={`/contacts/${contact.id}`} className="link">
                      {contact.name}
                    </Link>
                  ),
                ],
              ]}
            />
          </HeadedPanel>
        }
      >
        <Timeline area="deals" id={id} on={{ deal_id: id }} />
      </RecordColumns>
      {open === 'edit' && <DealForm deal={deal} onClosed={close} />}
      {open === 'delete' && (
        <ConfirmDelete
          what="deal"
          name={name}
          path={`/deals/${id}`}
          onDeleted={() => navigate('/deals', { flushSync: true })}
          onClosed={close}
        />
      )}
    </Page>
  )
}

/** Where a deal is among the stages (D7). */
function StagePath({ stage }: { stage: Stage }) {
  const config = useConfig()
  return (
    <ol aria-label="Stage" className="mb-4 grid grid-cols-6 gap-1.5">
      {STAGE_ORDER.map((key) => (
        <li
          key={key}
          aria-current={key === stage ? 'step' : undefined}
          className={`rounded-control px-4 py-2.5 ${key === stage ? `font-semibold ${STAGE_LOOKS[key].block}` : 'bg-white text-muted'}`}
        >
          {stageInfo(config, key).name}
        </li>
      ))}
    </ol>
  )
}
