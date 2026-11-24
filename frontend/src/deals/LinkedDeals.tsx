import { Link } from 'react-router'
import { Button } from '../shared/buttons'
import { date, money } from '../shared/format'
import { HeadedPanel, Row, Rows } from '../shared/panels'
import { LateTag } from './LateTag'
import type { LinkedDeal } from './queries'
import { StageName } from './StageName'

/** The deals on the page of an organization or a contact. */
export function LinkedDeals({ deals, onAdd }: { deals: LinkedDeal[]; onAdd: () => void }) {
  return (
    <HeadedPanel heading="Deals" action={<Button onClick={onAdd}>Add deal</Button>}>
      {deals.length === 0 && <p className="mt-2 text-muted">The sales you hope to make go here.</p>}
      <Rows>
        {deals.map((deal) => (
          <Row key={deal.id}>
            <span className="min-w-0">
              <Link to={`/deals/${deal.id}`} className="link font-semibold">{deal.name}</Link>
              <span className="block text-sm">
                <StageName stage={deal.stage} />
              </span>
            </span>
            <span className="num flex-none text-right text-sm">
              <span className="block font-medium">{money(deal.value)}</span>
              <span className="text-muted">{date(deal.close_date)}</span>
              {deal.days_late > 0 && <span className="mt-1 block font-sans"><LateTag days={deal.days_late} /></span>}
            </span>
          </Row>
        ))}
      </Rows>
    </HeadedPanel>
  )
}
