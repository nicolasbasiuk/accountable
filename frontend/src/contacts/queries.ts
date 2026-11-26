import { queryOptions, useMutation } from '@tanstack/react-query'
import type { LinkedDeal } from '../deals/queries'
import { get, patch, post } from '../shared/client'

export type Status = 'lead' | 'qualified' | 'customer'

export type Link = { id: number; name: string }

type Fields = {
  id: number
  name: string
  email: string | null
  phone: string | null
  job_title: string | null
  status: Status
  organization: Link | null
}

export type Contact = Fields & { last_activity: string | null; next_follow_up: string | null }

export type ContactDetails = Fields & { deals: LinkedDeal[] }

export const contactsQuery = queryOptions({ queryKey: ['contacts'], queryFn: () => get<Contact[]>('/contacts') })

export const contactQuery = (id: number) =>
  queryOptions({ queryKey: ['contacts', id], queryFn: () => get<ContactDetails>(`/contacts/${id}`) })

/** Adds one, or edits the one with the id. */
export const useSaveContact = (id?: number) =>
  useMutation({ mutationFn: (body: object) => (id ? patch(`/contacts/${id}`, body) : post('/contacts', body)) })
