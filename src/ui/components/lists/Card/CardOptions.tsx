import {useCallback, useEffect, useRef, useState} from 'react'
import {FaEdit, FaEllipsisV, FaExternalLinkAlt, FaPlay, FaTrash} from 'react-icons/fa'
import './Card.css'
import {useClickOutside} from '../../../../shared/hooks/useClickOutside'

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
    disabled?: boolean
    'aria-label'?: string
}

/**
 * Enhanced dropdown menu for card actions with improved accessibility, visual feedback,
 * and mystical theme integration for role-playing AI app
 */
export function CardOptions({
                                options,
                                align = 'right',
                                className = '',
                                disabled = false,
                                'aria-label': ariaLabel = 'Card options'
                            }: CardOptionsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null!)
    const buttonRef = useRef<HTMLButtonElement>(null!)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

    // Close menu when clicking outside
    useClickOutside(
        menuRef,
        () => {
            if (isOpen) {
                closeMenu()
            }
        },
        [buttonRef]
    )

    // Enhanced menu management
    const openMenu = useCallback(() => {
        if (disabled) return
        setIsOpen(true)
        // Focus first item after animation
        setTimeout(() => {
            itemRefs.current[0]?.focus()
        }, 150)
    }, [disabled])

    const closeMenu = useCallback(() => {
        setIsOpen(false)
        buttonRef.current?.focus()
    }, [])

    // Enhanced keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            switch (e.key) {
                case 'Escape':
                    e.preventDefault()
                    closeMenu()
                    break
                case 'ArrowDown':
                    e.preventDefault()
                    {
                        const currentFocus = document.activeElement as HTMLButtonElement
                        const currentIndex = itemRefs.current.indexOf(currentFocus)
                        const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0
                        itemRefs.current[nextIndex]?.focus()
                    }
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    {
                        const currentFocus = document.activeElement as HTMLButtonElement
                        const currentIndex = itemRefs.current.indexOf(currentFocus)
                        const nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1
                        itemRefs.current[nextIndex]?.focus()
                    }
                    break
                case 'Home':
                    e.preventDefault()
                    itemRefs.current[0]?.focus()
                    break
                case 'End':
                    e.preventDefault()
                    {
                        const lastIndex = options.length - 1
                        itemRefs.current[lastIndex]?.focus()
                    }
                    break
                case 'Tab':
                    // Allow tabbing out of menu
                    closeMenu()
                    break
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
        }

        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, options.length, closeMenu])

    const toggleMenu = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (disabled) return
        
        if (isOpen) {
            closeMenu()
        } else {
            openMenu()
        }
    }, [disabled, isOpen, openMenu, closeMenu])

    const handleItemClick = useCallback((e: React.MouseEvent, onClick: () => void, index: number) => {
        e.stopPropagation()
        if (disabled || options[index].disabled) return
        
        onClick()
        closeMenu()
    }, [disabled, options, closeMenu])

    const handleItemKeyDown = useCallback((e: React.KeyboardEvent, onClick: () => void, index: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!disabled && !options[index].disabled) {
                onClick()
                closeMenu()
            }
        }
    }, [disabled, options, closeMenu])

    // Get icon based on option type with improved mapping
    const getIcon = useCallback((type: CardOptionType) => {
        const iconMap = {
            delete: <FaTrash aria-hidden="true"/>,
            edit: <FaEdit aria-hidden="true"/>,
            start: <FaPlay aria-hidden="true"/>,
            open: <FaExternalLinkAlt aria-hidden="true"/>,
            custom: null
        }
        return iconMap[type]
    }, [])

    if (options.length === 0) return null

    // Enhanced single option rendering
    if (options.length === 1) {
        const option = options[0]
        const isDisabled = disabled || option.disabled
        
        return (
            <button
                className={`card-option-single ${option.danger ? 'danger' : ''} ${className}`}
                onClick={(e) => {
                    e.stopPropagation()
                    if (!isDisabled) {
                        option.onClick()
                    }
                }}
                disabled={isDisabled}
                aria-label={option.label}
                title={option.label}
                type="button"
                data-testid="card-option-single"
            >
                {option.icon || getIcon(option.type)}
            </button>
        )
    }

    const menuId = `card-options-menu-${Math.random().toString(36).substr(2, 9)}`

    return (
        <div className={`card-options ${className}`}>
            <button
                ref={buttonRef}
                className="card-options-button"
                onClick={toggleMenu}
                disabled={disabled}
                aria-label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                type="button"
                data-testid="card-options-button"
            >
                <FaEllipsisV/>
            </button>

            <div
                ref={menuRef}
                id={menuId}
                className={`card-options-menu ${align === 'left' ? 'align-left' : ''}`}
                role="menu"
                aria-orientation="vertical"
                aria-labelledby={buttonRef.current?.id || 'card-options-button'}
                data-enter={isOpen ? '' : undefined}
                data-testid="card-options-menu"
            >
                {options.map((option, index) => {
                    const icon = option.icon || getIcon(option.type)
                    const isDanger = option.danger || option.type === 'delete'
                    const isHighlight = ['start', 'open', 'edit'].includes(option.type)
                    const isDisabled = disabled || option.disabled

                    return (
                        <button
                            key={`${option.type}-${index}`}
                            ref={(el) => {
                                itemRefs.current[index] = el
                            }}
                            className="card-options-item"
                            onClick={(e) => handleItemClick(e, option.onClick, index)}
                            onKeyDown={(e) => handleItemKeyDown(e, option.onClick, index)}
                            disabled={isDisabled}
                            role="menuitem"
                            tabIndex={isOpen ? 0 : -1}
                            data-danger={isDanger ? '' : undefined}
                            data-highlight={isHighlight ? '' : undefined}
                            aria-label={option.label}
                            type="button"
                            data-testid={`card-option-${option.type}`}
                        >
                            {icon && (
                                <span className="option-icon" aria-hidden="true">
                                    {icon}
                                </span>
                            )}
                            <span>{option.label}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}