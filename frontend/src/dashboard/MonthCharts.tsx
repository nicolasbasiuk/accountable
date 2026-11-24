import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Rectangle, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis, type RectangleProps } from 'recharts'
import { money, monthAndYear, monthName, plural, shortMoney } from '../shared/format'
import { ChartPanel, Tip } from './ChartPanel'
import type { Month } from './queries'

const HEIGHT = 206
const GREEN = 'var(--color-sea-green)'
const DARK_GREEN = 'var(--color-green-dark)'
const HAIR = 'var(--color-hair)'
const TEXT = { fontFamily: 'var(--font-mono)', fontSize: 12, fill: 'var(--color-ink)' }
const LABEL = { ...TEXT, fontWeight: 600 }

/** How high the axis goes when there's nothing to show. */
const NO_REVENUE = 100_000

const MonthBar = (bar: RectangleProps) => <Rectangle {...bar} radius={[4, 4, 0, 0]} />

type TipProps = { active?: boolean; payload?: readonly { payload?: Month }[] }

function MonthTip({ active, payload }: TipProps) {
  const month = payload?.[0]?.payload
  return active && month ? <Tip heading={monthAndYear(month.month)} lines={[money(month.value), plural(month.deals, 'deal')]} /> : null
}

export function MonthCharts({ months }: { months: Month[] }) {
  const last = months.at(-1)!
  const highest = months.reduce((most, month) => (month.value > most.value ? month : most), last)
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
      <ChartPanel
        heading="Revenue won by month"
        table={{ headings: ['Month', 'Revenue won'], rows: months.map(({ month, value }) => [monthAndYear(month), money(value)]) }}
      >
        <div className="mt-3" role="group" aria-label="Line chart of the revenue won in each of the last 12 months">
          <ResponsiveContainer width="100%" height={HEIGHT} initialDimension={{ width: 600, height: HEIGHT }}>
            <AreaChart data={months} margin={{ top: 28, right: 86, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={HAIR} />
              <XAxis dataKey="month" tickFormatter={monthName} tick={TEXT} tickLine={false} axisLine={false} interval={0} height={24} padding={{ left: 14 }} />
              <YAxis tickFormatter={shortMoney} tick={TEXT} tickLine={false} axisLine={false} width={56} tickCount={3} domain={[0, highest.value > 0 ? 'auto' : NO_REVENUE]} />
              <Tooltip content={<MonthTip />} isAnimationActive={false} cursor={{ stroke: 'var(--color-sea-mist)' }} />
              <Area
                dataKey="value"
                type="monotone"
                stroke={DARK_GREEN}
                strokeWidth={2.5}
                fill={GREEN}
                fillOpacity={0.16}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 5, fill: DARK_GREEN, stroke: 'var(--color-white)', strokeWidth: 2 }}
              />
              {highest !== last && <Point month={highest} place="top" />}
              <Point month={last} place="right" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
      <ChartPanel
        heading="Deals won by month"
        table={{ headings: ['Month', 'Deals won'], rows: months.map(({ month, deals }) => [monthAndYear(month), deals]) }}
      >
        <div className="mt-3" role="group" aria-label="Bar chart of the number of deals won in each of the last 12 months">
          <ResponsiveContainer width="100%" height={HEIGHT} initialDimension={{ width: 400, height: HEIGHT }}>
            <BarChart data={months} margin={{ top: 22, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tickFormatter={monthName} tick={{ ...TEXT, fontSize: 11.5 }} tickLine={false} axisLine={{ stroke: HAIR }} interval={0} height={24} />
              <Tooltip content={<MonthTip />} isAnimationActive={false} cursor={{ fill: 'var(--color-page)' }} />
              <YAxis hide domain={[0, (most: number) => Math.max(most, 1)]} />
              {/* A shape of its own, because without one a month of 0 gets no number. */}
              <Bar dataKey="deals" fill={GREEN} shape={MonthBar} maxBarSize={22} isAnimationActive={false}>
                <LabelList dataKey="deals" position="top" offset={7} style={LABEL} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>
    </div>
  )
}

/** A month with its figure written beside it: the highest, and this one. */
function Point({ month, place }: { month: Month; place: 'top' | 'right' }) {
  return (
    <ReferenceDot
      x={month.month}
      y={month.value}
      r={5}
      fill={DARK_GREEN}
      stroke="var(--color-white)"
      strokeWidth={2}
      label={{ value: money(month.value), position: place, offset: place === 'top' ? 10 : 12, style: LABEL }}
    />
  )
}
