import React, { useState, useRef, useEffect } from 'react'
import '../App.css'

export type CardOptionType = 'open' | 'edit' | 'start' | 'delete'
export interface CardOption {
  type: CardOptionType
  label?: string
  onClick: () => void
}

/**
 * Dropdown menu for card actions, positioned top-right.
 */
export function CardOptions({ options }: { options: CardOption[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onBodyClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', onBodyClick)
    return () => document.removeEventListener('click', onBodyClick)
  }, [])

  return (
    <div className="card-options" ref={ref}>
      <button
        className="card-options-button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Card options"
      >
        ⋮
      </button>
      {open && (
        <div className="card-options-menu">
          {options.map((opt, i) => (
            <button
              key={i}
              className={`card-options-item ${opt.type}`}
              onClick={() => {
                setOpen(false)
                opt.onClick()
              }}
            >
              {opt.label ?? opt.type.charAt(0).toUpperCase() + opt.type.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}