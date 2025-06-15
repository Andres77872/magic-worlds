import React, { useState, useRef, useEffect } from 'react'
import { FaEllipsisV } from 'react-icons/fa'
import '../../App.css'

export type CardOptionType = 'open' | 'edit' | 'start' | 'delete' | 'custom'

export interface CardOptionBase {
  type: CardOptionType
  label: string
  onClick: () => void
  disabled?: boolean
  icon?: React.ReactNode
  danger?: boolean
}

export interface CustomCardOption extends Omit<CardOptionBase, 'type'> {
  type: 'custom'
  icon: React.ReactNode
}

export type CardOption = CardOptionBase | CustomCardOption

interface CardOptionsProps {
  options: CardOption[]
  align?: 'left' | 'right'
  className?: string
}

/**
 * Enhanced dropdown menu for card actions with support for icons and danger actions
 */
export function CardOptions({ 
  options, 
  align = 'right',
  className = '' 
}: CardOptionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onBodyClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('click', onBodyClick)
      document.addEventListener('keydown', onEscape)
    }

    return () => {
      document.removeEventListener('click', onBodyClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  if (options.length === 0) return null

  // If there's only one option, render it as a button directly
  if (options.length === 1) {
    const option = options[0]
    return (
      <button
        className={`card-option-single ${option.danger ? 'danger' : ''} ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          option.onClick()
        }}
        disabled={option.disabled}
        aria-label={option.label}
      >
        {option.icon || option.label}
      </button>
    )
  }

  return (
    <div 
      className={`card-options ${className}`} 
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="card-options-button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        aria-label="More options"
        disabled={options.every(opt => opt.disabled)}
      >
        <FaEllipsisV />
      </button>
      
      {open && (
        <div className={`card-options-menu ${align}`}>
          {options.map((option, i) => (
            <button
              key={i}
              className={`card-options-item ${option.type} ${option.danger ? 'danger' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                option.onClick()
              }}
              disabled={option.disabled}
              aria-label={option.label}
            >
              {option.icon && <span className="option-icon">{option.icon}</span>}
              <span className="option-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}