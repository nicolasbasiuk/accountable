import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AddButton, IconButton } from '../shared/buttons'
import { useConfig } from '../shared/config'
import { ConfirmDelete } from '../shared/ConfirmDelete'
import { Count } from '../shared/Count'
import { date, dateTime, daysBetween, shorten } from '../shared/format'
import { HeadedPanel } from '../shared/panels'
import { Loaded } from '../shared/states'
import { ActivityForm, type On } from './ActivityForm'
import { EntryIcon } from './EntryIcon'
import { EntryRecordLink, EntryText, entryName } from './entries'
import { timelineQuery, useSetDone, type ActivityEntry, type Area, type Entry } from './queries'

type Open = { what: 'log' } | { what: 'edit' | 'delete'; activity: ActivityEntry }

/** An activity has no name of its own, so it's called by what it says. */
const activityName = (description: string) => `"${shorten(description)}"`

/** Everything that happened with a record, newest first. Activities can be logged on contacts and deals only. */
export function Timeline({ area, id, on }: { area: Area; id: number; on?: On }) {
  const query = useQuery(timelineQuery(area, id))
  const [open, setOpen] = useState<Open | null>(null)
  const close = () => setOpen(null)
  return (
    <HeadedPanel heading="Timeline" action={on && <AddButton onClick={() => setOpen({ what: 'log' })}>Log activity</AddButton>}>
      <Loaded query={query}>
        {(entries) => (
          <>
            {entries.length === 0 && <p className="mt-2 text-muted">Notes, calls, emails and changes of stage go here.</p>}
            <ul className="mt-3 flex flex-col gap-1">
              {entries.map((entry) => (
                <Item
                  key={`${entry.kind} ${entry.id}`}
                  entry={entry}
                  here={area !== 'organizations' && `${entry.record.kind}s` === area && entry.record.id === id}
                  onEdit={(activity) => setOpen({ what: 'edit', activity })}
                  onDelete={(activity) => setOpen({ what: 'delete', activity })}
                />
              ))}
            </ul>
          </>
        )}
      </Loaded>
      {open?.what === 'log' && on && <ActivityForm on={on} onClosed={close} />}
      {open?.what === 'edit' && <ActivityForm activity={open.activity} onClosed={close} />}
      {open?.what === 'delete' && (
        <ConfirmDelete
          what="activity"
          name={activityName(open.activity.description)}
          path={`/activities/${open.activity.id}`}
          numbers={{ follow_ups: open.activity.follow_up_on ? 1 : 0 }}
          onClosed={close}
        />
      )}
    </HeadedPanel>
  )
}

type ItemProps = { entry: Entry; here: boolean; onEdit: (activity: ActivityEntry) => void; onDelete: (activity: ActivityEntry) => void }

function Item({ entry, here, onEdit, onDelete }: ItemProps) {
  return (
    <li className="flex items-start gap-3 py-2">
      <EntryIcon entry={entry} />
      <div className="min-w-0 flex-1">
        <p>
          <EntryText entry={entry} />
        </p>
        <p className="text-sm text-muted">
          {entryName(entry)}, <time dateTime={entry.at} className="num text-xs">{dateTime(entry.at)}</time>
          {!here && <span className="block"><EntryRecordLink record={entry.record} /></span>}
        </p>
        {entry.kind === 'activity' && entry.follow_up_on && <FollowUp activity={entry} day={entry.follow_up_on} />}
      </div>
      {entry.kind === 'activity' && (
        <div className="flex flex-none">
          <IconButton label={`Edit ${activityName(entry.description)}`} onClick={() => onEdit(entry)}>
            <Pencil size={16} aria-hidden />
          </IconButton>
          <IconButton label={`Delete ${activityName(entry.description)}`} onClick={() => onDelete(entry)}>
            <Trash2 size={16} aria-hidden />
          </IconButton>
        </div>
      )}
    </li>
  )
}

function FollowUp({ activity, day }: { activity: ActivityEntry; day: string }) {
  const { today } = useConfig()
  const setDone = useSetDone(activity.id)
  // Shown at once, until what was saved has loaded, or it couldn't be saved.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const done = chosen ?? activity.done
  const overdue = done ? 0 : daysBetween(day, today)
  return (
    <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={done}
        onChange={(event) => {
          setChosen(event.target.checked)
          setDone.mutate(event.target.checked, { onSettled: () => setChosen(null) })
        }}
        aria-label={`Done: ${activity.description}`}
        className="check"
      />
      <span className={`text-sm ${done ? 'text-muted line-through' : ''}`}>
        Follow up on <time dateTime={day} className="num text-xs">{date(day)}</time>
      </span>
      {done && <span className="text-sm font-medium">Done</span>}
      {overdue > 0 && <span className="tag">Overdue <Count amount={overdue} word="day" /></span>}
    </label>
  )
}
