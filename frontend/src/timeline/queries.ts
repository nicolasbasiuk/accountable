import { queryOptions, useMutation } from '@tanstack/react-query'
import type { Link } from '../contacts/queries'
import { explain, get, patch, post } from '../shared/client'
import type { Stage } from '../shared/config'
import { showProblem } from '../shared/messageStore'

export type ActivityType = 'note' | 'call' | 'email'

/** The deal or contact an entry belongs to. */
export type EntryRecord = { kind: 'deal' | 'contact'; id: number; name: string; organization: Link | null }

export type ActivityEntry = {
  kind: 'activity'
  id: number
  at: string
  type: ActivityType
  description: string
  follow_up_on: string | null
  done: boolean
  record: EntryRecord
}

export type StageChangeEntry = { kind: 'stage_change'; id: number; at: string; from_stage: Stage; to_stage: Stage; record: EntryRecord }

export type Entry = ActivityEntry | StageChangeEntry

export type Area = 'organizations' | 'contacts' | 'deals'

export const timelineQuery = (area: Area, id: number) =>
  queryOptions({ queryKey: [area, id, 'timeline'], queryFn: () => get<Entry[]>(`/${area}/${id}/timeline`) })

/** Logs one, or edits the one with the id. */
export const useSaveActivity = (id?: number) =>
  useMutation({ mutationFn: (body: object) => (id ? patch(`/activities/${id}`, body) : post('/activities', body)) })

/** Marks a follow-up done, or not done again (A3). */
export const useSetDone = (id: number) =>
  useMutation({
    mutationFn: (done: boolean) => patch(`/activities/${id}`, { done }),
    onError: (error) => showProblem(`Not saved. ${explain(error)}`),
  })
