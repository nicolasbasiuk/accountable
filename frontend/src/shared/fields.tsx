// The fields of a form. Each shows its problem under it (G6).
import { Autocomplete } from '@base-ui/react/autocomplete'
import { Select } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { useId, type ComponentProps, type ReactNode } from 'react'

export const CONTROL = 'w-full rounded-control bg-page px-3.5 placeholder:text-muted'
export const POPUP =
  'max-h-72 w-(--anchor-width) overflow-y-auto rounded-control bg-white p-1.5 shadow-lifted outline-none transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0'
export const ITEM =
  'flex cursor-default items-center gap-2.5 rounded-tag px-2.5 py-2 data-highlighted:bg-wash focus-visible:rounded-tag focus-visible:-outline-offset-2 focus-visible:outline-2'

type FieldProps = { label: string; error?: string; optional?: boolean; className?: string }

export type FieldIds = { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }

export function Field({
  label,
  error,
  optional,
  className = '',
  children,
}: FieldProps & { children: (ids: FieldIds) => ReactNode }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-problem` : undefined })}
      <Problem id={`${id}-problem`}>{error}</Problem>
    </div>
  )
}

function Problem({ id, children }: { id: string; children?: string }) {
  return (
    children && (
      <p id={id} className="mt-1.5 text-sm font-medium text-coral-dark">
        {children}
      </p>
    )
  )
}

export function TextField({
  label,
  error,
  optional,
  className,
  prefix,
  ...input
}: FieldProps & Omit<ComponentProps<'input'>, 'prefix'> & { prefix?: string }) {
  return (
    <Field label={label} error={error} optional={optional} className={className}>
      {(ids) => (
        <div className="relative">
          {prefix && (
            <span className="num pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
              {prefix}
            </span>
          )}
          <input
            type="text"
            autoComplete="off"
            {...ids}
            {...input}
            className={`${CONTROL} h-11 ${prefix ? 'num pl-7' : ''}`}
          />
        </div>
      )}
    </Field>
  )
}

/** A date, or a date and time. */
export function DateField({
  label,
  error,
  optional,
  className,
  type = 'date',
  ...input
}: FieldProps & ComponentProps<'input'>) {
  return (
    <Field label={label} error={error} optional={optional} className={className}>
      {(ids) => <input type={type} {...ids} {...input} className={`${CONTROL} num h-11 text-sm`} />}
    </Field>
  )
}

export function TextArea({ label, error, optional, className, ...input }: FieldProps & ComponentProps<'textarea'>) {
  return (
    <Field label={label} error={error} optional={optional} className={className}>
      {(ids) => <textarea rows={3} {...ids} {...input} className={`${CONTROL} block resize-y py-2.5`} />}
    </Field>
  )
}

export type Option = { value: string; label: string; show?: ReactNode }

/** One of a few, all in sight. */
export function ChoiceField({
  label,
  options,
  error,
  className,
  ...input
}: FieldProps & ComponentProps<'input'> & { options: Option[] }) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex gap-1 rounded-control bg-page p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-tag px-3 font-medium text-muted has-checked:bg-white has-checked:font-semibold has-checked:text-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-cerulean"
          >
            <input type="radio" {...input} value={option.value} className="sr-only" />
            {option.show ?? option.label}
          </label>
        ))}
      </div>
      <Problem id={`${label}-problem`}>{error}</Problem>
    </fieldset>
  )
}

type SelectProps = FieldProps & { value: string; onChange: (value: string) => void; options: Option[] }

export function SelectField({ label, error, className = '', value, onChange, options }: SelectProps) {
  const chosen = options.find((option) => option.value === value)
  return (
    <div className={className}>
      <Select.Root items={options} value={value} onValueChange={(next) => next !== null && onChange(next)}>
        <Select.Label className="mb-1.5 block cursor-default text-sm font-medium">{label}</Select.Label>
        <Select.Trigger className={`${CONTROL} flex h-11 cursor-pointer items-center justify-between`}>
          <Select.Value>{chosen?.show ?? chosen?.label}</Select.Value>
          <Select.Icon>
            <ChevronDown size={18} aria-hidden className="text-muted" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-40 outline-none">
            <Select.Popup className={POPUP}>
              <Select.List>
                {options.map((option) => (
                  <Select.Item key={option.value} value={option.value} className={ITEM}>
                    <Select.ItemText>{option.show ?? option.label}</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <Check size={16} aria-hidden />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Problem id={`${label}-problem`}>{error}</Problem>
    </div>
  )
}

type SuggestProps = FieldProps & { value: string; onChange: (value: string) => void; suggestions: string[] }

/** Free text that suggests what's already in use. */
export function SuggestField({ label, error, optional, className, value, onChange, suggestions }: SuggestProps) {
  return (
    <Field label={label} error={error} optional={optional} className={className}>
      {(ids) => (
        <Autocomplete.Root items={suggestions} value={value} onValueChange={onChange} openOnInputClick>
          <Autocomplete.Input {...ids} autoComplete="off" className={`${CONTROL} h-11`} />
          <Autocomplete.Portal>
            <Autocomplete.Positioner sideOffset={6} className="z-40 outline-none">
              <Autocomplete.Popup className={`${POPUP} data-empty:hidden`}>
                <Autocomplete.List>
                  {(suggestion: string) => (
                    <Autocomplete.Item key={suggestion} value={suggestion} className={ITEM}>
                      {suggestion}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      )}
    </Field>
  )
}
