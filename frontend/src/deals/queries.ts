import { queryOptions, useMutation } from '@tanstack/react-query'
import type { Link } from '../contacts/queries'
import { get, patch, post } from '../shared/client'
import type { Stage } from '../shared/config'

export type Deal = {
  id: number
  name: string
  organization: Link | null
  contact: Link | null
  stage: Stage
  value: number
  probability: number
  expected_revenue: number
  close_date: string
  days_late: number
}

/** A deal on the page of its organization or main contact. */
export type LinkedDeal = Pick<Deal, 'id' | 'name' | 'stage' | 'value' | 'close_date' | 'days_late'>

export const dealsQuery = queryOptions({ queryKey: ['deals'], queryFn: () => get<Deal[]>('/deals') })

export const dealQuery = (id: number) =>
  queryOptions({ queryKey: ['deals', id], queryFn: () => get<Deal>(`/deals/${id}`) })

/** Adds one, or edits the one with the id. */
export const useSaveDeal = (id?: number) =>
  useMutation({ mutationFn: (body: object) => (id ? patch(`/deals/${id}`, body) : post('/deals', body)) })
