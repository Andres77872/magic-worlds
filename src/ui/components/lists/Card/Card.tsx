import React, {useCallback, useMemo, useState} from 'react'
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
    'data-testid'?: string
}

/**
 * Modern Card component with clean, minimal design
 * Focused on accessibility and simplicity
 */
export function Card({
                         title,
                         subtitle,
                         children,
                         options,
                         actions,
                         className = '',
                         onClick,
                         isLoading = false,
                         disabled = false,
                         highlight = false,
                         'data-testid': testId = 'card',
                     }: CardProps) {
    const cardOptions = options || actions
    const [isHovered, setIsHovered] = useState(false)

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }, [onClick, disabled])

    const handleClick = useCallback(() => {
        if (!disabled && onClick) {
            onClick()
        }
    }, [onClick, disabled])

    const handleMouseEnter = useCallback(() => {
        if (!disabled) {
            setIsHovered(true)
        }
    }, [disabled])

    const handleMouseLeave = useCallback(() => {
        if (!disabled) {
            setIsHovered(false)
        }
    }, [disabled])

    const cardClasses = useMemo(() => [
        'card',
        onClick && !disabled ? 'clickable' : '',
        disabled ? 'disabled' : '',
        isHovered ? 'hover' : '',
        highlight ? 'highlight' : '',
        className,
    ].filter(Boolean).join(' '), [onClick, disabled, isHovered, highlight, className])

    const titleId = useMemo(() => `card-title-${Math.random().toString(36).substr(2, 9)}`, [])
    const descriptionId = useMemo(() =>
            subtitle ? `card-description-${Math.random().toString(36).substr(2, 9)}` : undefined,
        [subtitle]
    )

    const isInteractive = onClick && !disabled

    return (
        <article
            className={cardClasses}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={isInteractive ? handleKeyDown : undefined}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            data-testid={testId}
            role={isInteractive ? 'button' : 'article'}
            tabIndex={isInteractive ? 0 : undefined}
            aria-disabled={disabled || undefined}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={isLoading || undefined}
        >
            {isLoading && (
                <div 
                    className="card-loading-overlay" 
                    role="alert" 
                    aria-live="polite"
                    aria-label="Loading card content"
                >
                    <div className="card-loading-spinner" aria-hidden="true"/>
                    <span className="visually-hidden">Loading...</span>
                </div>
            )}

            <header className="card-header">
                <div className="card-header-content">
                    <h3 id={titleId} className="card-title">
                        {typeof title === 'string' ? (
                            <span className="card-title-text" title={title}>
                                {title}
                            </span>
                        ) : (
                            title
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
                        <CardOptions 
                            options={cardOptions}
                            disabled={disabled}
                            aria-label="Card actions"
                        />
                    </div>
                )}
            </header>

            {children && (
                <div className="card-content" role="region" aria-label="Card content">
                    {children}
                </div>
            )}
        </article>
    )
}