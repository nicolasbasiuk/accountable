import type { ReactNode } from 'react'

export function Panel({
  className = '',
  label,
  children,
}: {
  className?: string
  label?: string
  children: ReactNode
}) {
  return (
    <section aria-label={label} className={`rounded-panel bg-panel ${className}`}>
      {children}
    </section>
  )
}

type PageProps = {
  title: string
  heading?: ReactNode
  under?: ReactNode
  action?: ReactNode
  fill?: boolean
  children: ReactNode
}

/** A heading, one main action, the content. With "fill", the content has the height of the window. */
export function Page({ title, heading, under, action, fill = false, children }: PageProps) {
  return (
    <main
      className={`px-5 pt-6.5 pl-2 min-[1401px]:pr-8 min-[1401px]:pl-4.5 ${fill ? 'flex h-screen flex-col pb-5' : 'max-w-[1640px] pb-12'}`}
    >
      <title>{title === 'Dashboard' ? 'Accountable' : `${title} - Accountable`}</title>
      <header className="mb-4.5 flex min-h-11 items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] wrap-anywhere">{heading ?? title}</h1>
          {under}
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}

type HeadedPanelProps = { heading: string; action?: ReactNode; className?: string; low?: boolean; children: ReactNode }

/** A panel with a heading, and sometimes a button beside it. A low one has no room for a button. */
export function HeadedPanel({ heading, action, className = '', low = false, children }: HeadedPanelProps) {
  return (
    <Panel label={heading} className={`px-6 py-5 ${className}`}>
      <div className={`flex justify-between gap-4 ${low ? 'items-baseline' : 'min-h-10.5 items-center'}`}>
        <h2 className="text-lg leading-[1.3] font-semibold">{heading}</h2>
        {action}
      </div>
      {children}
    </Panel>
  )
}

/** A record's fields. Blank ones are left out. */
export function Details({ fields }: { fields: [label: string, value: ReactNode][] }) {
  const filled = fields.filter(([, value]) => value !== null && value !== undefined && value !== '')
  return (
    <dl className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-4 gap-y-3">
      {filled.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Details and linked records on one side, the timeline on the other. */
export function RecordColumns({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-4">
      <div className="flex flex-col gap-4">{side}</div>
      {children}
    </div>
  )
}

/** The rows of linked records. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="mt-2 flex flex-col">{children}</ul>
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 border-t border-hair py-2.5 first:border-0">{children}</li>
  )
}
