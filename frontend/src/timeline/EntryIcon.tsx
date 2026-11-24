import { ArrowRight, Mail, Phone, StickyNote } from 'lucide-react'
import type { Entry } from './queries'

const ICONS = { note: StickyNote, call: Phone, email: Mail }

export function EntryIcon({ entry }: { entry: Entry }) {
  const Icon = entry.kind === 'activity' ? ICONS[entry.type] : ArrowRight
  return (
    <span aria-hidden className="grid size-8.5 flex-none place-items-center rounded-[11px] bg-page">
      <Icon size={17} />
    </span>
  )
}
