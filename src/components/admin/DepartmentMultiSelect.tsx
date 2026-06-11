import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, X } from 'lucide-react'

type DepartmentMultiSelectProps = {
  id: string
  departments: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  disabled?: boolean
  placeholder?: string
  emptyHint?: string
}

function filterDepartments(departments: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return departments
  return departments.filter((department) => department.toLowerCase().includes(q))
}

export function DepartmentMultiSelect({
  id,
  departments,
  selected,
  onChange,
  disabled = false,
  placeholder = 'Select departments…',
  emptyHint = 'Sync employees first',
}: DepartmentMultiSelectProps) {
  const listboxId = useId()
  const searchInputId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const filtered = useMemo(
    () => filterDepartments(departments, search),
    [departments, search],
  )
  const searchActive = search.trim().length > 0
  const selectedSet = useMemo(() => new Set(selected), [selected])

  useEffect(() => {
    if (!open) {
      setSearch('')
      return
    }
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open || !triggerRef.current) return

    function updateMenuPosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const menuHeight = 320
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow
      const maxMenuWidth = Math.min(window.innerWidth - 32, 420)

      setMenuStyle({
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - maxMenuWidth - 16),
        top: openUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
        minWidth: rect.width,
        width: 'max-content',
        maxWidth: maxMenuWidth,
        maxHeight: menuHeight,
        zIndex: 1200,
      })
    }

    updateMenuPosition()
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateMenuPosition)
        : null
    if (triggerRef.current) observer?.observe(triggerRef.current)

    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, selected])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function toggleDepartment(department: string) {
    onChange(
      selectedSet.has(department)
        ? selected.filter((value) => value !== department)
        : [...selected, department],
    )
  }

  function removeDepartment(department: string, event: React.MouseEvent) {
    event.stopPropagation()
    onChange(selected.filter((value) => value !== department))
  }

  function selectAllVisible() {
    const next = new Set(selected)
    for (const department of filtered) next.add(department)
    onChange([...next].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })))
  }

  function clearAll() {
    onChange([])
  }

  if (departments.length === 0) {
    return <span className="pd-muted">{emptyHint}</span>
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((department) => selectedSet.has(department))

  return (
    <div className="pd-dept-select" ref={rootRef}>
      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-disabled={disabled || undefined}
        className={`pd-dept-select__trigger${selected.length ? ' pd-dept-select__trigger--filled' : ''}${open ? ' pd-dept-select__trigger--open' : ''}${disabled ? ' pd-dept-select__trigger--disabled' : ''}`}
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setOpen((current) => !current)
          }
        }}
      >
        <span className="pd-dept-select__body">
          {selected.length === 0 ? (
            <span className="pd-dept-select__placeholder">{placeholder}</span>
          ) : (
            <span className="pd-dept-select__chips" aria-label={`${selected.length} departments selected`}>
              {selected.map((department) => (
                <span key={department} className="pd-dept-select__chip">
                  <span className="pd-dept-select__chip-label">{department}</span>
                  {!disabled ? (
                    <button
                      type="button"
                      className="pd-dept-select__chip-remove"
                      aria-label={`Remove ${department}`}
                      onClick={(event) => removeDepartment(department, event)}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  ) : null}
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`pd-dept-select__chevron${open ? ' pd-dept-select__chevron--open' : ''}`}
        />
      </div>

      {open ? (
        <div
          ref={menuRef}
          className="pd-dept-select__menu pd-multi-select__menu"
          style={menuStyle}
          role="presentation"
        >
          <div className="pd-multi-select__search">
            <label className="pd-sr-only" htmlFor={searchInputId}>
              Search departments
            </label>
            <input
              id={searchInputId}
              className="pd-input"
              type="search"
              placeholder="Search departments…"
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

          {filtered.length === 0 ? (
            <p className="pd-multi-select__empty">
              {searchActive ? 'No departments match your search.' : 'No departments available.'}
            </p>
          ) : (
            <ul id={listboxId} className="pd-multi-select__list" role="listbox" aria-multiselectable>
              {filtered.map((department) => {
                const checked = selectedSet.has(department)
                return (
                  <li key={department} role="presentation">
                    <label className="pd-multi-select__option">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDepartment(department)}
                      />
                      <span>{department}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="pd-dept-select__footer">
            <div className="pd-dept-select__footer-actions">
              <button
                type="button"
                className="pd-dept-select__footer-btn"
                disabled={filtered.length === 0 || allVisibleSelected}
                onClick={selectAllVisible}
              >
                {searchActive ? 'Select matches' : 'Select all'}
              </button>
              <button
                type="button"
                className="pd-dept-select__footer-btn"
                disabled={selected.length === 0}
                onClick={clearAll}
              >
                Clear all
              </button>
            </div>
            <span className="pd-dept-select__footer-count">
              {selected.length} of {departments.length} selected
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
