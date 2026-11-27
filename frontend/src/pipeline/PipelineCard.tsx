import { Draggable } from '@hello-pangea/dnd'
import { Link } from 'react-router'
import { LateTag } from '../deals/LateTag'
import { date, money, percent } from '../shared/format'
import type { Card } from './board'

/**
 * The link covers the whole card and is also what drags it. So there's one thing to focus on each
 * card: Space lifts it, and Enter or a click opens the deal.
 */
export function PipelineCard({ card, index }: { card: Card; index: number }) {
  return (
    <Draggable draggableId={String(card.id)} index={index}>
      {(provided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`relative mb-2 min-w-0 rounded-card bg-panel p-2.75 has-focus-visible:outline-3 has-focus-visible:-outline-offset-3 has-focus-visible:outline-cerulean min-[1401px]:px-3.25 min-[1401px]:py-3 ${snapshot.isDragging ? 'shadow-lifted' : ''}`}
        >
          <Link
            to={`/deals/${card.id}`}
            {...provided.dragHandleProps}
            role={undefined}
            draggable={false}
            className="link leading-[1.3] font-semibold outline-none after:absolute after:inset-0 after:cursor-grab"
          >
            {card.name}
          </Link>
          <p className="mt-px mb-2 min-h-[18px] text-[13.5px] leading-[1.35] text-muted">{card.organization}</p>
          <p className="num flex flex-wrap justify-between gap-x-1.5 text-[13.5px] font-medium">
            <span>{money(card.value)}</span>
            <span>{percent(card.probability)}</span>
          </p>
          <p className="num mt-px text-[12.5px] text-muted">{date(card.close_date)}</p>
          {card.days_late > 0 && (
            <p className="mt-2">
              <LateTag days={card.days_late} />
            </p>
          )}
        </article>
      )}
    </Draggable>
  )
}
