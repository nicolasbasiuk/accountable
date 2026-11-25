// What the server decides for every screen: today, now and the stages (G8, D3).
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { get } from './client'

export type Stage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export type StageInfo = { key: Stage; name: string; probability: number; open: boolean }

export type Config = { today: string; now: string; stages: StageInfo[] }

export const configQuery = queryOptions({ queryKey: ['config'], queryFn: () => get<Config>('/config') })

const MINUTE = 60_000

/** For the frame, which is always there. Asks every minute, so a screen left open past midnight follows the new day (G8). */
export function useCurrentConfig() {
  const client = useQueryClient()
  const query = useQuery({ ...configQuery, refetchInterval: MINUTE })
  const today = query.data?.today
  const before = useRef(today)
  useEffect(() => {
    // What's late, overdue or in the last 90 days changes with it.
    if (before.current && today !== before.current) void client.invalidateQueries()
    before.current = today
  }, [client, today])
  return query
}

/** The frame shows a page only once this has loaded. */
export function useConfig(): Config {
  const { data } = useQuery({ ...configQuery, staleTime: Infinity })
  if (!data) throw new Error('A page was shown before the config had loaded.')
  return data
}

export function stageInfo(config: Config, stage: Stage): StageInfo {
  return config.stages.find(({ key }) => key === stage)!
}
