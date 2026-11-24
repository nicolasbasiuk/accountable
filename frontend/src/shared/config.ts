// What the server decides for every screen: today, now and the stages (G8, D3).
import { queryOptions, useQuery } from '@tanstack/react-query'
import { get } from './client'

export type Stage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export type StageInfo = { key: Stage; name: string; probability: number; open: boolean }

export type Config = { today: string; now: string; stages: StageInfo[] }

export const configQuery = queryOptions({ queryKey: ['config'], queryFn: () => get<Config>('/config') })

/** The frame shows a page only once this has loaded. */
export function useConfig(): Config {
  const { data } = useQuery({ ...configQuery, staleTime: Infinity })
  if (!data) throw new Error('A page was shown before the config had loaded.')
  return data
}

export function stageInfo(config: Config, stage: Stage): StageInfo {
  return config.stages.find(({ key }) => key === stage)!
}
