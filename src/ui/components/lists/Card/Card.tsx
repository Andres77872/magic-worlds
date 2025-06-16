import React, {useCallback, useMemo, useState} from 'react'
import {FaChevronRight} from 'react-icons/fa'
import {type CardOption, CardOptions} from './CardOptions'
import './Card.css'

interface CardProps {
    title: React.ReactNode
    subtitle?: React.ReactNode
    children?: React.ReactNode
    /** @deprecated Use options instead */
    actions?: CardOption[]
    options?: CardOption[]
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
                         options,
                         actions, // For backward compatibility
                         className = '',
                         onClick,
                         isLoading = false,
                         disabled = false,
                         highlight = false,
                     }: CardProps) {
    // Use options prop if provided, otherwise fall back to actions for backward compatibility
    const cardOptions = options || actions;
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

    // Generate a unique ID for accessibility
    const titleId = useMemo(() => `card-title-${Math.random().toString(36).substr(2, 9)}`, [])
    const descriptionId = useMemo(() =>
            subtitle ? `card-description-${Math.random().toString(36).substr(2, 9)}` : undefined,
        [subtitle]
    )

    return (
        <article
            className={cardClasses}
            role={onClick && !disabled ? 'button' : 'article'}
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
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            data-testid="card"
        >
            {isLoading && (
                <div className="card-loading-overlay" role="alert" aria-busy="true">
                    <div className="card-loading-spinner" aria-hidden="true"/>
                    <span className="visually-hidden">Loading...</span>
                </div>
            )}

            <div className="card-header">
                <div className="card-header-content">
                    <h3 id={titleId} className="card-title" tabIndex={-1}>
                        {typeof title === 'string' ? (
                            <span className="card-title-text">{title}</span>
                        ) : (
                            title
                        )}
                        {onClick && !disabled && (
                            <span className="card-arrow" aria-hidden="true">
                <FaChevronRight/>
              </span>
                        )}
                    </h3>
                    {subtitle && (
                        <div id={descriptionId} className="card-subtitle">
                            {subtitle}
                        </div>
                    )}
                </div>
                {cardOptions && cardOptions.length > 0 && (
                    <div className="card-options">
                        <CardOptions options={cardOptions}/>
                    </div>
                )}
            </div>

            {children && (
                <div className="card-content">
                    {children}
                </div>
            )}
        </article>
    )
}