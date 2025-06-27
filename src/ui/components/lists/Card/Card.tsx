import React, {useCallback, useMemo, useState, useRef, useEffect} from 'react'
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
    'data-testid'?: string
}

/**
 * Enhanced Card component with improved accessibility, mystical hover states, and visual feedback
 * Designed for role-playing AI app with character, world, and adventure cards
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
                         'data-testid': testId = 'card',
                     }: CardProps) {
    // Use options prop if provided, otherwise fall back to actions for backward compatibility
    const cardOptions = options || actions;
    const [isHovered, setIsHovered] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const cardRef = useRef<HTMLElement>(null)

    // Enhanced keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        if (disabled) return
        
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (e.key === ' ') {
                // Space key will be handled in keyup to prevent page scroll
                return
            }
            onClick?.()
        }
    }, [onClick, disabled])

    const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        if (disabled) return
        
        if (e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }, [onClick, disabled])

    // Enhanced click handler with disabled state check
    const handleClick = useCallback(() => {
        if (!disabled && onClick) {
            onClick()
        }
    }, [onClick, disabled])

    // Mouse event handlers
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

    const handleFocus = useCallback(() => {
        if (!disabled) {
            setIsFocused(true)
        }
    }, [disabled])

    const handleBlur = useCallback(() => {
        if (!disabled) {
            setIsFocused(false)
        }
    }, [disabled])

    // Intersection observer for entrance animation
    useEffect(() => {
        const currentCard = cardRef.current
        if (!currentCard) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible')
                        observer.unobserve(entry.target)
                    }
                })
            },
            { 
                threshold: 0.1,
                rootMargin: '50px 0px'
            }
        )

        observer.observe(currentCard)

        return () => {
            if (currentCard) {
                observer.unobserve(currentCard)
            }
        }
    }, [])

    // Dynamic class generation with proper state management
    const cardClasses = useMemo(() => [
        'card',
        onClick && !disabled ? 'clickable' : '',
        disabled ? 'disabled' : '',
        isHovered ? 'hover' : '',
        isFocused ? 'focus-visible' : '',
        highlight ? 'highlight' : '',
        className,
    ].filter(Boolean).join(' '), [onClick, disabled, isHovered, isFocused, highlight, className])

    // Generate unique IDs for accessibility
    const titleId = useMemo(() => `card-title-${Math.random().toString(36).substr(2, 9)}`, [])
    const descriptionId = useMemo(() =>
            subtitle ? `card-description-${Math.random().toString(36).substr(2, 9)}` : undefined,
        [subtitle]
    )

    // Determine if card should be interactive
    const isInteractive = onClick && !disabled
    
    // ARIA attributes for better accessibility
    const ariaAttributes = useMemo(() => ({
        role: isInteractive ? 'button' : 'article',
        tabIndex: isInteractive ? 0 : undefined,
        'aria-disabled': disabled || undefined,
        'aria-labelledby': titleId,
        'aria-describedby': descriptionId,
        'aria-busy': isLoading || undefined,
    }), [isInteractive, disabled, titleId, descriptionId, isLoading])

    return (
        <article
            ref={cardRef}
            className={cardClasses}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={isInteractive ? handleKeyDown : undefined}
            onKeyUp={isInteractive ? handleKeyUp : undefined}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={isInteractive ? handleFocus : undefined}
            onBlur={isInteractive ? handleBlur : undefined}
            data-testid={testId}
            {...ariaAttributes}
        >
            {/* Loading overlay with improved accessibility */}
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

            {/* Card header with improved structure */}
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
                        {isInteractive && (
                            <span 
                                className="card-arrow" 
                                aria-hidden="true"
                                role="presentation"
                            >
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
                
                {/* Card options with improved conditional rendering */}
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

            {/* Card content with proper semantic structure */}
            {children && (
                <div className="card-content" role="region" aria-label="Card content">
                    {children}
                </div>
            )}
        </article>
    )
}