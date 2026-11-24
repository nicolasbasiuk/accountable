import { queryOptions, useMutation } from '@tanstack/react-query'
import { explain, get, patch } from '../shared/client'
import type { Stage } from '../shared/config'
import { shorten } from '../shared/format'
import { showMessage, showProblem } from '../shared/messageStore'
import type { ActivityEntry, Entry } from '../timeline/queries'

export type Amount = { value: number; deals: number }

export type Month = Amount & { month: string }

export type OpenStage = Amount & { stage: Stage; expected: number }

/** The share is of the stage before, if there was anything in it. */
export type FunnelStage = Amount & { stage: Stage; share: number | null }

export type FollowUp = ActivityEntry & { follow_up_on: string }

export type Dashboard = {
  today: string
  figures: { won_this_month: Amount; won_12_months: Amount; open: Amount; expected: number }
  months: Month[]
  stages: OpenStage[]
  funnel: FunnelStage[]
  follow_ups: FollowUp[]
  recent: Entry[]
  overdue: number
  late: number
}

export const dashboardQuery = queryOptions({ queryKey: ['dashboard'], queryFn: () => get<Dashboard>('/dashboard') })

/** Marks a follow-up done, and offers Undo (B5). */
export function useFinish() {
  const save = useMutation({
    mutationFn: ({ followUp, done }: { followUp: FollowUp; done: boolean }) => patch(`/activities/${followUp.id}`, { done }),
    onSuccess: (_saved, { followUp, done }) => {
      if (done) showMessage(`Done: ${shorten(followUp.description)}`, () => save.mutate({ followUp, done: false }))
    },
    onError: (error) => showProblem(`Not saved. ${explain(error)}`),
  })
  return save
}
