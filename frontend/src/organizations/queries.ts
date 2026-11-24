import { queryOptions, useMutation } from '@tanstack/react-query'
import type { Status } from '../contacts/queries'
import type { LinkedDeal } from '../deals/queries'
import { get, patch, post } from '../shared/client'

type Fields = { id: number; name: string; website: string | null; industry: string | null; notes: string | null }

export type Organization = Fields & { contacts: number; open_deals: number; open_value: number }

export type OrganizationDetails = Fields & {
  open_value: number
  value_won: number
  contacts: { id: number; name: string; job_title: string | null; status: Status }[]
  deals: LinkedDeal[]
}

export const organizationsQuery = queryOptions({ queryKey: ['organizations'], queryFn: () => get<Organization[]>('/organizations') })

export const organizationQuery = (id: number) =>
  queryOptions({ queryKey: ['organizations', id], queryFn: () => get<OrganizationDetails>(`/organizations/${id}`) })

/** Adds one, or edits the one with the id. */
export const useSaveOrganization = (id?: number) =>
  useMutation({ mutationFn: (body: object) => (id ? patch(`/organizations/${id}`, body) : post('/organizations', body)) })
