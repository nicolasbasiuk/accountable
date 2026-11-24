import { useState } from 'react'
import { daysBetween, due, plural } from '../shared/format'
import { HeadedPanel } from '../shared/panels'
import { EntryRecordLink } from '../timeline/entries'
import { useFinish, type FollowUp } from './queries'

/** What's overdue, then what's due in the next 14 days, soonest first (B5). */
export function FollowUps({ followUps, today }: { followUps: FollowUp[]; today: string }) {
  const overdue = followUps.filter(({ follow_up_on }) => follow_up_on < today)
  const soon = followUps.filter(({ follow_up_on }) => follow_up_on >= today)
  return (
    <HeadedPanel heading="Follow-ups" low>
      {followUps.length === 0 && (
        <p className="mt-2 text-muted">Nothing to follow up in the next 14 days. A follow-up date on an activity puts it here.</p>
      )}
      <Group heading="Overdue" followUps={overdue} today={today} />
      <Group heading="Due in the next 14 days" followUps={soon} today={today} />
    </HeadedPanel>
  )
}

function Group({ heading, followUps, today }: { heading: string; followUps: FollowUp[]; today: string }) {
  if (followUps.length === 0) return null
  return (
    <section aria-label={heading} className="mt-4">
      <h3 className="flex items-baseline gap-2 font-semibold">
        {heading} <span className="num font-medium text-muted">{followUps.length}</span>
      </h3>
      <ul className="mt-1">
        {followUps.map((followUp) => (
          <Item key={followUp.id} followUp={followUp} today={today} />
        ))}
      </ul>
    </section>
  )
}

function Item({ followUp, today }: { followUp: FollowUp; today: string }) {
  const finish = useFinish()
  const [done, setDone] = useState(false)
  const late = daysBetween(followUp.follow_up_on, today)
  return (
    <li className="grid min-h-10 grid-cols-[20px_minmax(0,1.12fr)_minmax(0,1fr)_100px] items-center gap-3 py-1 text-[14.5px] leading-[1.35]">
      <input
        type="checkbox"
        checked={done}
        onChange={() => {
          setDone(true)
          // If it's saved, the list loads without it.
          finish.mutate({ followUp, done: true }, { onError: () => setDone(false) })
        }}
        disabled={done}
        aria-label={`Mark done: ${followUp.description}`}
        className="check"
      />
      <span className="wrap-anywhere">{followUp.description}</span>
      <span className="text-sm wrap-anywhere text-muted">
        <EntryRecordLink record={followUp.record} />
      </span>
      <span className="justify-self-end">
        {late > 0 ? <span className="tag">{plural(late, 'day')}</span> : <time dateTime={followUp.follow_up_on} className="num text-xs">{due(followUp.follow_up_on, today)}</time>}
      </span>
    </li>
  )
}
