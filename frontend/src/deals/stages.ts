import type { Stage } from '../shared/config'

export const STAGE_ORDER: Stage[] = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

type Look = {
  /** The dot beside its name, and its bars. */
  fill: string
  /** Its block on the pipeline and its part of the funnel, with a text color that can be read on it. */
  block: string
  color: string
  onColor: string
}

const MIDNIGHT = 'var(--color-midnight)'
const WHITE = 'var(--color-white)'

/**
 * A won deal shouldn't look like a warning, so Won is the ink color, Midnight or Sea Mist by mode,
 * and Raspberry only means late or overdue.
 */
export const STAGE_LOOKS: Record<Stage, Look> = {
  new: {
    fill: 'bg-sea-green',
    block: 'bg-sea-green text-midnight',
    color: 'var(--color-sea-green)',
    onColor: MIDNIGHT,
  },
  qualified: {
    fill: 'bg-marigold',
    block: 'bg-marigold text-midnight',
    color: 'var(--color-marigold)',
    onColor: MIDNIGHT,
  },
  proposal: { fill: 'bg-coral', block: 'bg-coral text-midnight', color: 'var(--color-coral)', onColor: MIDNIGHT },
  negotiation: { fill: 'bg-cerulean', block: 'bg-cerulean text-white', color: 'var(--color-cerulean)', onColor: WHITE },
  won: { fill: 'bg-won', block: 'bg-won text-on-won', color: 'var(--color-won)', onColor: 'var(--color-on-won)' },
  // No text can be read well on Lost's own color, so its block is a quiet one close to the page.
  lost: {
    fill: 'bg-lost',
    block: 'bg-lost-block text-on-lost-block',
    color: 'var(--color-lost)',
    onColor: 'var(--color-on-lost-block)',
  },
}
