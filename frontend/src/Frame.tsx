import { useQuery } from '@tanstack/react-query'
import { BriefcaseBusiness, Building2, Kanban, LayoutDashboard, Users } from 'lucide-react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router'
import { configQuery } from './shared/config'
import { Messages } from './shared/Messages'
import { ErrorState, OutOfDate } from './shared/states'

const SECTIONS = [
  { path: '/', name: 'Dashboard', Icon: LayoutDashboard },
  { path: '/organizations', name: 'Organizations', Icon: Building2 },
  { path: '/contacts', name: 'Contacts', Icon: Users },
  { path: '/deals', name: 'Deals', Icon: BriefcaseBusiness },
  { path: '/pipeline', name: 'Pipeline', Icon: Kanban },
]

export function Frame() {
  const config = useQuery(configQuery)
  return (
    <Messages>
      <div className="grid min-h-screen grid-cols-[208px_minmax(0,1fr)]">
        <aside className="sticky top-0 h-screen px-3.5 py-7.5">
          <div className="flex items-center gap-2.5 px-3 pb-7 text-[18px] leading-[26px] font-bold tracking-[-0.02em]">
            <Mark />
            Accountable
          </div>
          <nav aria-label="Sections" className="flex flex-col gap-0.5">
            {SECTIONS.map(({ path, name, Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className="flex items-center gap-3 rounded-control px-3 py-2.5 font-medium text-muted hover:text-ink aria-[current=page]:bg-white aria-[current=page]:font-semibold aria-[current=page]:text-ink"
              >
                <Icon size={18} aria-hidden />
                {name}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          {config.data && config.error && <OutOfDate error={config.error} />}
          {config.data ? <Outlet /> : config.error && <ErrorState error={config.error} />}
        </div>
      </div>
      <ScrollRestoration />
    </Messages>
  )
}

function Mark() {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true">
      <rect width="26" height="6" rx="3" className="fill-sea-green" />
      <rect x="4" y="8" width="18" height="6" rx="3" className="fill-marigold" />
      <rect x="8" y="16" width="10" height="6" rx="3" className="fill-coral" />
    </svg>
  )
}
