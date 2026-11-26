// Choosing a linked record by typing part of its name.
import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, X } from 'lucide-react'
import { CONTROL, Field, ITEM, POPUP } from './fields'

export type PickerItem = { value: number; label: string; detail?: string | null }
export type PickerGroup = { value: string; items: PickerItem[] }

type Props = {
  label: string
  /** What's chosen, such as "organization". */
  what: string
  value: number | null
  onChange: (value: number | null) => void
  /** The groups in order. A group without a name has no heading. */
  groups: PickerGroup[]
  error?: string
  className?: string
}

export function RecordPicker({ label, what, value, onChange, groups, error, className }: Props) {
  const chosen = groups.flatMap(({ items }) => items).find((item) => item.value === value) ?? null
  return (
    <Field label={label} error={error} optional className={className}>
      {(ids) => (
        <Combobox.Root
          items={groups}
          value={chosen}
          onValueChange={(item: PickerItem | null) => onChange(item?.value ?? null)}
          isItemEqualToValue={(item: PickerItem, other: PickerItem) => item.value === other.value}
          autoHighlight
        >
          <Combobox.InputGroup className="relative">
            <Combobox.Input
              {...ids}
              placeholder={`No ${what}`}
              autoComplete="off"
              className={`${CONTROL} h-11 pr-19`}
            />
            <div className="absolute inset-y-0 right-1.5 flex items-center text-muted">
              <Combobox.Clear
                aria-label={`Clear ${what}`}
                className="grid size-8 cursor-pointer place-items-center rounded-tag hover:bg-wash"
              >
                <X size={16} aria-hidden />
              </Combobox.Clear>
              <Combobox.Trigger
                aria-label={`Show every ${what}`}
                className="grid size-8 cursor-pointer place-items-center rounded-tag hover:bg-wash"
              >
                <ChevronDown size={18} aria-hidden />
              </Combobox.Trigger>
            </div>
          </Combobox.InputGroup>
          <Combobox.Portal>
            <Combobox.Positioner sideOffset={6} className="z-40 outline-none">
              <Combobox.Popup className={POPUP}>
                <Combobox.Empty>
                  <div className="px-2.5 py-2 text-muted">No {what} matches.</div>
                </Combobox.Empty>
                <Combobox.List>
                  {(group: PickerGroup) => (
                    <Combobox.Group key={group.value} items={group.items}>
                      {group.value && (
                        <Combobox.GroupLabel className="px-2.5 pt-2 pb-1 text-sm font-medium text-muted">
                          {group.value}
                        </Combobox.GroupLabel>
                      )}
                      <Combobox.Collection>
                        {(item: PickerItem) => (
                          <Combobox.Item key={item.value} value={item} className={ITEM}>
                            <span className="min-w-0 flex-1">
                              {item.label}
                              {item.detail && <span className="block text-sm text-muted">{item.detail}</span>}
                            </span>
                            <Combobox.ItemIndicator>
                              <Check size={16} aria-hidden />
                            </Combobox.ItemIndicator>
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      )}
    </Field>
  )
}
