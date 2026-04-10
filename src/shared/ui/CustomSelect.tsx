import { useEffect, useMemo, useRef, useState } from 'react'

export interface CustomSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface CustomSelectProps {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  triggerClassName?: string
  menuClassName?: string
  optionClassName?: string
  ariaLabel?: string
}

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
  ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? options[0] ?? null,
    [options, value],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className={`custom-select ${open ? 'open' : ''} ${className ?? ''}`.trim()}
    >
      <button
        type="button"
        className={`select-trigger ${triggerClassName ?? ''}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current)
          }
        }}
      >
        <span className="select-trigger-text">{selected?.label ?? ''}</span>
      </button>

      <div className={`select-menu ${menuClassName ?? ''}`.trim()} role="listbox">
        {options.map((option) => {
          const isSelected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`select-option ${isSelected ? 'is-selected' : ''} ${
                optionClassName ?? ''
              }`.trim()}
              disabled={option.disabled}
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value)
                  setOpen(false)
                }
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

