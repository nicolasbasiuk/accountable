import { Droppable } from '@hello-pangea/dnd'
import { Plus } from 'lucide-react'
import { STAGE_LOOKS } from '../deals/stages'
import { stageInfo, useConfig, type Stage } from '../shared/config'
import { money } from '../shared/format'
import type { Column } from './board'
import { PipelineCard } from './PipelineCard'

// The Add button, a shade lighter or darker than its block.
const ADD_LOOKS: Partial<Record<Stage, string>> = {
  negotiation: 'bg-black/20 hover:bg-black/30',
  won: 'bg-white/16 hover:bg-white/25',
}

export function PipelineColumn({ column, onAdd }: { column: Column; onAdd: () => void }) {
  const { stage, cards } = column
  const { name, open } = stageInfo(useConfig(), stage)
  return (
    <section aria-label={name} className="flex min-h-0 min-w-0 flex-col">
      <div className={`mb-2 min-h-29.5 rounded-block px-3.25 pt-3 pb-3.25 ${STAGE_LOOKS[stage].block}`}>
        <div className="flex items-center gap-1.75">
          <h2 className="text-[15.5px] font-semibold tracking-[-0.01em]">{name}</h2>
          <span className="num text-sm font-semibold">{column.count}</span>
          <button
            type="button"
            aria-label={`Add deal in ${name}`}
            title={`Add deal in ${name}`}
            onClick={onAdd}
            className={`ml-auto grid size-7 cursor-pointer place-items-center rounded-[9px] ${ADD_LOOKS[stage] ?? 'bg-white/35 hover:bg-white/60'}`}
          >
            <Plus size={17} aria-hidden />
          </button>
        </div>
        <p className="num text-xl leading-[1.3] font-semibold tracking-[-0.05em] wrap-anywhere">{money(column.value)}</p>
        <p className="text-sm leading-[1.35] font-semibold tracking-[-0.01em] wrap-anywhere">
          <span className="num tracking-[-0.05em]">{money(column.expected)}</span> expected
        </p>
        {!open && (
          <p className="text-sm leading-[1.35] font-semibold tracking-[-0.01em]">
            Last <span className="num tracking-[-0.05em]">90</span> days
          </p>
        )}
      </div>
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto rounded-t-card pb-6 transition-colors duration-150 ${snapshot.isDraggingOver ? 'bg-wash' : ''}`}
          >
            {cards.map((card, index) => (
              <PipelineCard key={card.id} card={card} index={index} />
            ))}
            {provided.placeholder}
            {cards.length === 0 && !snapshot.isDraggingOver && (
              <p className="px-3 py-4 text-center text-sm text-muted">{open ? `No deals in ${name}.` : `No deals ${name.toLowerCase()} in the last 90 days.`}</p>
            )}
          </div>
        )}
      </Droppable>
    </section>
  )
}
