import { STAGE_LOOKS } from '../deals/stages'
import { stageInfo, useConfig } from '../shared/config'
import { money, plural } from '../shared/format'
import { ChartPanel, Tip, TipOn } from './ChartPanel'
import type { OpenStage } from './queries'

const light = (color: string) => `color-mix(in srgb, ${color} 30%, var(--color-white))`

/** The open value of each stage, with its expected revenue in the solid part (B3). */
export function OpenDeals({ stages }: { stages: OpenStage[] }) {
  const config = useConfig()
  const name = ({ stage }: OpenStage) => stageInfo(config, stage).name
  const highest = Math.max(...stages.map(({ value }) => value), 1)
  const part = (some: number, all: number) => `${all > 0 ? (some / all) * 100 : 0}%`
  return (
    <div className="mt-4">
      <ChartPanel
        heading="Open deals by stage"
        table={{
          headings: ['Stage', 'Deals', 'Open value', 'Expected revenue'],
          rows: stages.map((row) => [name(row), row.deals, money(row.value), money(row.expected)]),
        }}
      >
        <div className="mt-2.5 grid grid-cols-[128px_minmax(0,1fr)_auto_auto] items-center gap-x-6 gap-y-4">
          <span aria-hidden />
          <p className="text-sm text-muted">
            <Swatch color="var(--color-ink)" /> Expected <Swatch color={light('var(--color-ink)')} className="ml-3" /> Rest
          </p>
          <p className="text-right text-sm text-muted">Open value</p>
          <p className="text-right text-sm text-muted">Expected</p>
          {stages.map((row) => {
            const { color, fill } = STAGE_LOOKS[row.stage]
            const lines = [`${money(row.value)} open value`, `${money(row.expected)} expected`, plural(row.deals, 'deal')]
            return (
              <div key={row.stage} className="contents">
                <p className="flex items-center gap-2 leading-tight font-semibold">
                  <i aria-hidden className={`size-2.75 flex-none rounded-full ${fill}`} />
                  <span>
                    {name(row)}
                    <span className="block text-sm font-normal text-muted">
                      <span className="num">{row.deals}</span> {row.deals === 1 ? 'deal' : 'deals'}
                    </span>
                  </span>
                </p>
                <div className="h-10.5">
                  <TipOn label={`${name(row)}: ${lines.join(', ')}`} tip={<Tip heading={name(row)} lines={lines} />}>
                    <div className="relative h-full min-w-1 overflow-hidden rounded-[10px]" style={{ width: part(row.value, highest), background: light(color) }}>
                      <i className="absolute inset-y-0 left-0 rounded-[10px]" style={{ width: part(row.expected, row.value), background: color }} />
                    </div>
                  </TipOn>
                </div>
                <p className="num text-right font-semibold">{money(row.value)}</p>
                <p className="num text-right font-semibold">{money(row.expected)}</p>
              </div>
            )
          })}
        </div>
      </ChartPanel>
    </div>
  )
}

function Swatch({ color, className = '' }: { color: string; className?: string }) {
  return <i aria-hidden className={`mr-1 inline-block size-3.5 rounded-[4px] align-[-2px] ${className}`} style={{ background: color }} />
}
