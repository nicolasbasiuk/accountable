import { Plus } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

const LOOKS = {
  main: 'bg-sea-green text-midnight hover:bg-[#05c795]',
  quiet: 'bg-wash text-ink hover:bg-hair',
  danger: 'bg-raspberry text-white hover:bg-[#e33c65]',
}

type ButtonProps = ComponentProps<'button'> & { look?: keyof typeof LOOKS }

export function Button({ look = 'quiet', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-control px-4 py-2.75 leading-none font-semibold whitespace-nowrap disabled:cursor-default disabled:opacity-60 ${LOOKS[look]} ${className}`}
      {...props}
    />
  )
}

/** The one main action of a page, such as "Add deal". */
export function AddButton({ children, ...props }: ComponentProps<'button'>) {
  return (
    <Button look="main" className="pr-4.5 pl-3.5" {...props}>
      <Plus size={18} aria-hidden />
      {children}
    </Button>
  )
}

/** A button with only an icon. Its label is for screen readers and shows when pointed at. */
export function IconButton({ label, className = '', children, ...props }: ComponentProps<'button'> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-8 cursor-pointer place-items-center rounded-tag text-muted hover:bg-wash hover:text-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A button that reads as a link, such as "Show table". */
export function LinkButton({ className = '', ...props }: ComponentProps<'button'>) {
  return <button type="button" className={`link cursor-pointer ${className}`} {...props} />
}
