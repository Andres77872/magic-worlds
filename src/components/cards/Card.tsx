import React, { useCallback, useState } from 'react'
import './cards.css'
import { CardOptions, type CardOption } from './CardOptions'
import { FaChevronRight } from 'react-icons/fa'

interface CardProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  children?: React.ReactNode
  actions?: CardOption[]
  className?: string
  onClick?: () => void
  isLoading?: boolean
  disabled?: boolean
  highlight?: boolean
}

/**
 * Enhanced Card component with improved accessibility, hover states, and visual feedback
 */
export function Card({
  title,
  subtitle,
  children,
  actions,
  className = '',
  onClick,
  isLoading = false,
  disabled = false,
  highlight = false,
}: CardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isActive, setIsActive] = useState(false)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (e.key === ' ') {
        // Space key will be handled in keyup to prevent page scroll
        return
      }
      onClick?.()
    }
  }, [onClick])

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }, [onClick])

  const cardClasses = [
    'card',
    onClick && !disabled ? 'clickable' : '',
    disabled ? 'disabled' : '',
    isHovered ? 'hover' : '',
    isFocused ? 'focus-visible' : '',
    isActive ? 'active' : '',
    highlight ? 'highlight' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div 
      className={cardClasses}
      role={onClick && !disabled ? 'button' : 'listitem'}
      onClick={disabled ? undefined : onClick}
      onKeyDown={!disabled ? handleKeyDown : undefined}
      onKeyUp={!disabled ? handleKeyUp : undefined}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        if (!disabled) {
          setIsHovered(false)
          setIsActive(false)
        }
      }}
      onFocus={() => !disabled && setIsFocused(true)}
      onBlur={() => !disabled && setIsFocused(false)}
      onMouseDown={() => !disabled && setIsActive(true)}
      onMouseUp={() => !disabled && setIsActive(false)}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-disabled={disabled}
      data-testid="card"
    >
      {isLoading && (
        <div className="card-loading-overlay">
          <div className="card-loading-spinner" />
        </div>
      )}
      
      <div className="card-header">
        <div className="card-header-content">
          <h3 className="card-title">
            {typeof title === 'string' ? (
              <span>{title}</span>
            ) : (
              title
            )}
            {onClick && !disabled && (
              <span className="card-arrow" aria-hidden="true">
                <FaChevronRight />
              </span>
            )}
          </h3>
          {actions && actions.length > 0 && (
            <div className="card-actions-wrapper">
              <CardOptions options={actions} disabled={disabled} />
            </div>
          )}
        </div>
        {subtitle && (
          <div className="card-subtitle">
            {typeof subtitle === 'string' ? (
              <span>{subtitle}</span>
            ) : (
              subtitle
            )}
          </div>
        )}
      </div>
      
      {children && (
        <div className="card-content">
          {children}
        </div>
      )}
      

    </div>
  )
}