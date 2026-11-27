import { Tooltip } from '@base-ui/react/tooltip'
import { useState, type ReactElement, type ReactNode } from 'react'
import { LinkButton } from '../shared/buttons'
import { HeadedPanel } from '../shared/panels'

type Table = { headings: string[]; rows: ReactNode[][] }

/** A chart, or the same figures as a table. */
export function ChartPanel({ heading, table, children }: { heading: string; table: Table; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <HeadedPanel
      heading={heading}
      action={
        <LinkButton
          className="text-sm text-muted"
          aria-expanded={asTable}
          aria-label={`${asTable ? 'Show chart' : 'Show table'}: ${heading}`}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? 'Show chart' : 'Show table'}
        </LinkButton>
      }
      low
    >
      {asTable ? <Figures heading={heading} {...table} /> : children}
    </HeadedPanel>
  )
}

function Figures({ heading, headings, rows }: Table & { heading: string }) {
  return (
    <table className="mt-2 w-full text-sm">
      <caption className="sr-only">{heading}</caption>
      <thead>
        <tr>
          {headings.map((name) => (
            <th key={name} scope="col" className="py-1.5 text-right font-medium text-muted first:text-left">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([first, ...others], index) => (
          <tr key={index}>
            <th scope="row" className="border-t border-hair py-1.5 text-left font-normal">
              {first}
            </th>
            {others.map((cell, place) => (
              <td key={place} className="num border-t border-hair py-1.5 text-right text-xs">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** What a tooltip looks like, on every chart. */
export function Tip({ heading, lines }: { heading: string; lines: string[] }) {
  return (
    <div className="rounded-control bg-raised px-3.5 py-2.5 text-sm shadow-lifted">
      <p className="font-semibold">{heading}</p>
      {lines.map((line) => (
        <p key={line} className="num text-xs">
          {line}
        </p>
      ))}
    </div>
  )
}

/** A part of a drawing that shows a tooltip when it's pointed at or focused. */
export function TipOn({ label, tip, children }: { label: string; tip: ReactNode; children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={0} closeOnClick={false} render={children} tabIndex={0} role="img" aria-label={label} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8} className="z-20">
          <Tooltip.Popup>{tip}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
