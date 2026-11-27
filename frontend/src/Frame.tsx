import { Switch } from '@base-ui/react/switch'
import { LayoutDashboard, Users } from 'lucide-react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router'
import { DealsIcon, OrganizationsIcon, PipelineIcon } from './icons'
import { setMode, useMode } from './mode'
import { useCurrentConfig } from './shared/config'
import { Messages } from './shared/Messages'
import { ErrorState, OutOfDate } from './shared/states'

const SECTIONS = [
  { path: '/', name: 'Dashboard', Icon: LayoutDashboard },
  { path: '/organizations', name: 'Organizations', Icon: OrganizationsIcon },
  { path: '/contacts', name: 'Contacts', Icon: Users },
  { path: '/deals', name: 'Deals', Icon: DealsIcon },
  { path: '/pipeline', name: 'Pipeline', Icon: PipelineIcon },
]

export function Frame() {
  const config = useCurrentConfig()
  return (
    <Messages>
      <div className="grid min-h-screen grid-cols-[208px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-screen flex-col px-3.5 py-7.5">
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
                className="flex items-center gap-3 rounded-control px-3 py-2.5 font-medium text-muted hover:text-ink aria-[current=page]:bg-panel aria-[current=page]:font-semibold aria-[current=page]:text-ink"
              >
                <Icon size={18} aria-hidden />
                {name}
              </NavLink>
            ))}
          </nav>
          <ModeSwitch />
        </aside>
        <div className="min-w-0">
          {config.data && <OutOfDate />}
          {config.data ? <Outlet /> : config.error && <ErrorState error={config.error} />}
        </div>
      </div>
      <ScrollRestoration />
    </Messages>
  )
}

/** Turns dark mode on and off, at the foot of the sidebar on every page (G10). */
function ModeSwitch() {
  const mode = useMode()
  return (
    <label className="mt-auto flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 font-medium text-muted hover:text-ink">
      Dark mode
      <Switch.Root
        checked={mode === 'dark'}
        onCheckedChange={(checked) => setMode(checked ? 'dark' : 'light')}
        className="ml-auto flex h-5 w-8.5 flex-none cursor-pointer items-center rounded-full bg-muted p-0.5 data-checked:bg-green-line"
      >
        <Switch.Thumb className="size-4 rounded-full bg-panel transition-transform duration-150 data-checked:translate-x-3.5" />
      </Switch.Root>
    </label>
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
