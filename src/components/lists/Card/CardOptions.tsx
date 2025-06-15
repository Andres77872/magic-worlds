import {useCallback, useEffect, useRef, useState} from 'react'
import {FaEdit, FaEllipsisV, FaExternalLinkAlt, FaPlay, FaTrash} from 'react-icons/fa'
import './Card.css'
import {useClickOutside} from '../../../hooks/useClickOutside'

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
}

/**
 * Enhanced dropdown menu for card actions with support for icons and danger actions
 */
export function CardOptions({
                                options,
                                align = 'right',
                                className = '',
                                disabled = false
                            }: CardOptionsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null!)
    const buttonRef = useRef<HTMLButtonElement>(null!)

    // Close menu when clicking outside
    useClickOutside(
        menuRef,
        () => {
            if (isOpen) setIsOpen(false);
        },
        [buttonRef]
    )

    // Close menu when pressing Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault()
                setIsOpen(false)
                buttonRef.current?.focus()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen])

    const toggleMenu = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (disabled) return
        setIsOpen(prev => !prev)
    }, [disabled])

    const handleItemClick = useCallback((e: React.MouseEvent, onClick: () => void) => {
        e.stopPropagation()
        if (disabled) return
        onClick()
        setIsOpen(false)
    }, [disabled])

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
                type="button"
            >
                {option.icon || option.label}
            </button>
        )
    }

    // Get icon based on option type
    const getIcon = (type: CardOptionType) => {
        switch (type) {
            case 'delete':
                return <FaTrash aria-hidden="true"/>
            case 'edit':
                return <FaEdit aria-hidden="true"/>
            case 'start':
                return <FaPlay aria-hidden="true"/>
            case 'open':
                return <FaExternalLinkAlt aria-hidden="true"/>
            default:
                return null
        }
    }

    return (
        <div className={`card-options ${className}`}>
            <button
                ref={buttonRef}
                className="card-options-button"
                onClick={toggleMenu}
                disabled={disabled}
                aria-label="Card options"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={`card-options-menu`}
                aria-disabled={disabled}
                type="button"
            >
                <FaEllipsisV aria-hidden="true"/>
            </button>

            <div
                ref={menuRef}
                id="card-options-menu"
                className={`card-options-menu ${align === 'left' ? 'align-left' : ''}`}
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!isOpen}
                aria-labelledby={`${buttonRef.current?.id || 'card-options-button'}`}
                data-enter={isOpen ? '' : undefined}
                style={{
                    position: 'absolute',
                    right: align === 'left' ? 'auto' : 0,
                    left: align === 'left' ? 0 : 'auto'
                }}
            >
                {options.map((option, index) => {
                    const icon = option.icon || getIcon(option.type)
                    const isDanger = option.danger || option.type === 'delete'
                    const isHighlight = ['start', 'open', 'edit'].includes(option.type)

                    return (
                        <button
                            key={`${option.type}-${index}`}
                            className="card-options-item"
                            onClick={(e) => handleItemClick(e, option.onClick)}
                            disabled={option.disabled || disabled}
                            role="menuitem"
                            tabIndex={-1}
                            data-danger={isDanger ? '' : undefined}
                            data-highlight={isHighlight ? '' : undefined}
                            aria-label={option.label}
                            type="button"
                        >
                            {icon && <span className="option-icon" aria-hidden="true">{icon}</span>}
                            <span>{option.label}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}