import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { DealForm } from '../deals/DealForm'
import { AddButton } from '../shared/buttons'
import { money, plural, share } from '../shared/format'
import { Page, Panel } from '../shared/panels'
import { Loaded } from '../shared/states'
import { FollowUps } from './FollowUps'
import { FunnelRibbon } from './FunnelRibbon'
import { MonthCharts } from './MonthCharts'
import { OpenDeals } from './OpenDeals'
import { dashboardQuery, type Dashboard } from './queries'
import { RecentActivity } from './RecentActivity'
import { summary } from './summary'

export function DashboardPage() {
  const query = useQuery(dashboardQuery)
  return <Loaded query={query}>{(dashboard) => <Shown dashboard={dashboard} />}</Loaded>
}

function Shown({ dashboard }: { dashboard: Dashboard }) {
  const [adding, setAdding] = useState(false)
  const { today, figures, months, funnel, stages, follow_ups, recent, overdue, late } = dashboard
  const { won_this_month, won_12_months, open, expected } = figures
  return (
    <Page
      title="Dashboard"
      under={<p className="mt-0.5 font-serif text-[21px] leading-[1.3]">{summary(overdue, late)}</p>}
      action={<AddButton onClick={() => setAdding(true)}>Add deal</AddButton>}
    >
      <Panel label="Figures" className="mb-4 px-7 py-5">
        <dl className="grid grid-cols-4">
          <Figure label="Revenue won this month" amount={won_this_month.value} under={plural(won_this_month.deals, 'deal')} />
          <Figure label="Revenue won in 12 months" amount={won_12_months.value} under={plural(won_12_months.deals, 'deal')} />
          <Figure label="Open value" amount={open.value} under={plural(open.deals, 'deal')} />
          <Figure label="Expected revenue" amount={expected} under={open.value > 0 ? `${share(expected / open.value)} of open value` : 'No open value'} />
        </dl>
      </Panel>
      <MonthCharts months={months} />
      <FunnelRibbon funnel={funnel} />
      <OpenDeals stages={stages} />
      <div className="mt-4 grid grid-cols-[minmax(0,21fr)_minmax(0,10fr)] items-start gap-4">
        <FollowUps followUps={follow_ups} today={today} />
        <RecentActivity entries={recent} today={today} />
      </div>
      {adding && <DealForm onClosed={() => setAdding(false)} />}
    </Page>
  )
}

function Figure({ label, amount, under }: { label: string; amount: number; under: string }) {
  const [number, ...words] = under.split(' ')
  return (
    <div className="min-w-0 pr-4">
      <dt className="text-[14.5px] text-muted">{label}</dt>
      <dd className="num mt-0.5 text-3xl leading-[1.2] font-medium tracking-[-0.04em]">{money(amount)}</dd>
      <dd className="mt-0.5 text-sm text-muted">
        <span className={/\d/.test(number!) ? 'num' : ''}>{number}</span> {words.join(' ')}
      </dd>
    </div>
  )
}
