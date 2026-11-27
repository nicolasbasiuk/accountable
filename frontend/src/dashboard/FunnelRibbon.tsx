import { useEffect, useId, useRef, useState } from 'react'
import { STAGE_LOOKS } from '../deals/stages'
import { stageInfo, useConfig } from '../shared/config'
import { money, plural, share } from '../shared/format'
import { ChartPanel, Tip, TipOn } from './ChartPanel'
import type { FunnelStage } from './queries'
import { ribbon } from './ribbon'

const HEIGHT = 178
/** The least thickness that two lines of text fit in. */
const ROOM_FOR_TEXT = 48

export function FunnelRibbon({ funnel }: { funnel: FunnelStage[] }) {
  const config = useConfig()
  const name = (row: FunnelStage) => stageInfo(config, row.stage).name
  const shareText = (row: FunnelStage, index: number) =>
    row.share !== null && `${share(row.share)} of ${name(funnel[index - 1]!)}`
  return (
    <ChartPanel
      heading="How far deals get"
      table={{
        headings: ['Stage', 'Value that reached it', 'Deals', 'Share of the stage before'],
        rows: funnel.map((row) => [name(row), money(row.value), row.deals, row.share === null ? '' : share(row.share)]),
      }}
    >
      <div className="relative mt-4 mb-3.5" style={{ height: HEIGHT }}>
        <Drawing funnel={funnel} />
        <div
          className="absolute inset-0 grid grid-cols-5"
          role="group"
          aria-label="Funnel of the value that reached each stage"
        >
          {funnel.map((row, index) => {
            const lines = [money(row.value), plural(row.deals, 'deal'), shareText(row, index)].filter(
              (line) => line !== false,
            )
            return (
              <TipOn
                key={row.stage}
                label={`${name(row)}: ${lines.join(', ')}`}
                tip={<Tip heading={name(row)} lines={lines} />}
              >
                <div />
              </TipOn>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-5">
        {funnel.map((row) => (
          <p key={row.stage} className="flex items-center gap-2 font-semibold">
            <i aria-hidden className={`size-2.75 flex-none rounded-full ${STAGE_LOOKS[row.stage].fill}`} />
            {name(row)}
          </p>
        ))}
      </div>
    </ChartPanel>
  )
}

/** Drawn at its real size, so text keeps its own, and again whenever that changes. */
function Drawing({ funnel }: { funnel: FunnelStage[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const clip = useId()
  useEffect(() => {
    const watcher = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width))
    watcher.observe(box.current!)
    return () => watcher.disconnect()
  }, [])

  const middle = HEIGHT / 2
  const { path, parts } = ribbon(
    funnel.map(({ value }) => value),
    Math.max(width, 1),
    HEIGHT,
  )
  return (
    <div ref={box} aria-hidden className="size-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block">
          <clipPath id={clip}>
            <path d={path} />
          </clipPath>
          {funnel.map(({ stage }, index) => (
            <rect
              key={stage}
              x={parts[index]!.x}
              width={parts[index]!.width}
              height={HEIGHT}
              fill={STAGE_LOOKS[stage].color}
              clipPath={`url(#${clip})`}
            />
          ))}
          {funnel.map((row, index) => {
            const { thickness, flatX } = parts[index]!
            // A thin part's text goes above it, where it can be read.
            const inside = thickness >= ROOM_FOR_TEXT
            const y = inside ? middle : middle - Math.max(thickness / 2, 15) - 28
            const fill = inside ? STAGE_LOOKS[row.stage].onColor : 'var(--color-ink)'
            return (
              <g key={row.stage} fill={fill} className="num" fontWeight={600}>
                <text x={flatX || 22} y={y - 2} fontSize={17} letterSpacing="-0.03em">
                  {money(row.value)}
                </text>
                <text x={flatX || 22} y={y + 18} fontSize={14}>
                  {plural(row.deals, 'deal')}
                </text>
              </g>
            )
          })}
          {funnel.map(
            ({ stage, share: fraction }, index) =>
              fraction !== null && (
                <g key={stage} className="num">
                  <rect
                    x={parts[index]!.x - 27}
                    y={middle - 15}
                    width={54}
                    height={30}
                    rx={15}
                    fill="var(--color-panel)"
                  />
                  <text
                    x={parts[index]!.x}
                    y={middle + 5}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={600}
                    fill="var(--color-ink)"
                  >
                    {share(fraction)}
                  </text>
                </g>
              ),
          )}
        </svg>
      )}
    </div>
  )
}
