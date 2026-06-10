import { useEffect, useId, useRef, useState } from 'react'

export type FilterMultiSelectOption = {
  value: string
  label: string
}

type FilterMultiSelectProps = {
  id: string
  label: string
  options: FilterMultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  active?: boolean
}

function selectionLabel(
  selected: string[],
  options: FilterMultiSelectOption[],
  placeholder: string,
): string {
  if (selected.length === 0) return placeholder
  if (selected.length === 1) {
    return options.find((o) => o.value === selected[0])?.label ?? selected[0]
  }
  return `${selected.length} selected`
}

export function FilterMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
  active = false,
}: FilterMultiSelectProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function toggleValue(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    )
  }

  return (
    <div className="pd-form-row">
      <span className="pd-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="pd-multi-select" ref={rootRef}>
        <button
          id={id}
          type="button"
          className={`pd-multi-select__trigger${active ? ' pd-filter-control--active' : ''}`}
          aria-labelledby={`${id}-label`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="pd-multi-select__value">
            {selectionLabel(selected, options, placeholder)}
          </span>
          <span className="pd-multi-select__chevron" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <ul id={listboxId} className="pd-multi-select__menu" role="listbox" aria-multiselectable>
            {options.map((option) => {
              const checked = selected.includes(option.value)
              return (
                <li key={option.value} role="presentation">
                  <label className="pd-multi-select__option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
