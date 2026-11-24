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

/** A won deal shouldn't look like a warning, so Won is Midnight, and Raspberry only means late or overdue. */
export const STAGE_LOOKS: Record<Stage, Look> = {
  new: { fill: 'bg-sea-green', block: 'bg-sea-green text-midnight', color: 'var(--color-sea-green)', onColor: MIDNIGHT },
  qualified: { fill: 'bg-marigold', block: 'bg-marigold text-midnight', color: 'var(--color-marigold)', onColor: MIDNIGHT },
  proposal: { fill: 'bg-coral', block: 'bg-coral text-midnight', color: 'var(--color-coral)', onColor: MIDNIGHT },
  negotiation: { fill: 'bg-cerulean', block: 'bg-cerulean text-white', color: 'var(--color-cerulean)', onColor: WHITE },
  won: { fill: 'bg-midnight', block: 'bg-midnight text-white', color: MIDNIGHT, onColor: WHITE },
  // No text can be read well on Lost's own color, so its block is Sea Mist.
  lost: { fill: 'bg-lost', block: 'bg-sea-mist text-midnight', color: 'var(--color-lost)', onColor: MIDNIGHT },
}
