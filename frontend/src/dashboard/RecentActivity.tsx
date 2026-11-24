import { date, dayOf } from '../shared/format'
import { HeadedPanel } from '../shared/panels'
import { EntryIcon } from '../timeline/EntryIcon'
import { EntryRecordLink, EntryText, entryName } from '../timeline/entries'
import type { Entry } from '../timeline/queries'

/** The newest entries from every timeline, by day (B6). */
export function RecentActivity({ entries, today }: { entries: Entry[]; today: string }) {
  const days = [...new Set(entries.map(({ at }) => dayOf(at)))]
  return (
    <HeadedPanel heading="Recent activity" low>
      {entries.length === 0 && <p className="mt-2 text-muted">What happens with your contacts and deals goes here.</p>}
      {days.map((day) => (
        <section key={day} className="mt-4">
          <h3 className="num font-medium text-muted">{day === today ? 'Today' : date(day)}</h3>
          <ul className="mt-1">
            {entries
              .filter(({ at }) => dayOf(at) === day)
              .map((entry) => (
                <li key={`${entry.kind} ${entry.id}`} className="flex items-center gap-3 py-1.5 text-[14.5px] leading-[1.4]">
                  <EntryIcon entry={entry} />
                  <div className="min-w-0 flex-1">
                    <span className="sr-only">{entryName(entry)}: </span>
                    <span className="line-clamp-3">
                      <EntryText entry={entry} />
                    </span>
                    <span className="block text-sm wrap-anywhere text-muted">
                      <EntryRecordLink record={entry.record} />
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </HeadedPanel>
  )
}
