import { stageInfo, useConfig, type Stage } from '../shared/config'
import { STAGE_LOOKS } from './stages'

/** A colored dot with its name, because color is never the only sign. */
export function StageName({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <i aria-hidden className={`size-2.5 flex-none rounded-full ${STAGE_LOOKS[stage].fill}`} />
      {stageInfo(useConfig(), stage).name}
    </span>
  )
}
