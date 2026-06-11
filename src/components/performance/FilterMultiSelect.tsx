import { useEffect, useId, useMemo, useRef, useState } from 'react'

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
  searchPlaceholder?: string
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

function filterOptions(
  options: FilterMultiSelectOption[],
  query: string,
): FilterMultiSelectOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((option) => {
    const haystack = `${option.label} ${option.value}`.toLowerCase()
    return haystack.includes(q)
  })
}

export function FilterMultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = 'All',
  searchPlaceholder = 'Search…',
  active = false,
}: FilterMultiSelectProps) {
  const listboxId = useId()
  const searchInputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = useMemo(() => filterOptions(options, search), [options, search])
  const searchActive = search.trim().length > 0

  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }
    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

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
          <div className="pd-multi-select__menu">
            <div className="pd-multi-select__search">
              <label className="pd-sr-only" htmlFor={searchInputId}>
                Search {label}
              </label>
              <input
                ref={searchInputRef}
                id={searchInputId}
                className="pd-input"
                type="search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setOpen(false)
                  }
                }}
              />
            </div>
            {filteredOptions.length === 0 ? (
              <p className="pd-multi-select__empty">
                {searchActive ? 'No matches for your search.' : 'No options available.'}
              </p>
            ) : (
              <ul
                id={listboxId}
                className="pd-multi-select__list"
                role="listbox"
                aria-multiselectable
              >
                {filteredOptions.map((option) => {
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
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
