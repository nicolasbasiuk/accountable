// How an entry reads, here and on the dashboard.
import { Link } from 'react-router'
import { stageInfo, useConfig } from '../shared/config'
import type { Entry, EntryRecord } from './queries'

const TYPE_NAMES = { note: 'Note', call: 'Call', email: 'Email' }

export const entryName = (entry: Entry) => (entry.kind === 'activity' ? TYPE_NAMES[entry.type] : 'Change of stage')

/** What was logged, or "Moved from Proposal to Negotiation". */
export function EntryText({ entry }: { entry: Entry }) {
  const config = useConfig()
  if (entry.kind === 'activity') return <span className="whitespace-pre-line wrap-anywhere">{entry.description}</span>
  return `Moved from ${stageInfo(config, entry.from_stage).name} to ${stageInfo(config, entry.to_stage).name}`
}

/** The record an entry belongs to, and its organization, both linked. */
export function EntryRecordLink({ record }: { record: EntryRecord }) {
  return (
    <>
      <Link to={`/${record.kind}s/${record.id}`} className="link">{record.name}</Link>
      {record.organization && (
        <>, <Link to={`/organizations/${record.organization.id}`} className="link">{record.organization.name}</Link></>
      )}
    </>
  )
}
