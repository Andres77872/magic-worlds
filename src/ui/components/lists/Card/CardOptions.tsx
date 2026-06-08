import {useCallback, useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {ExternalLink, MoreVertical, Pencil, Play, Trash2} from 'lucide-react'
import {useClickOutside} from '../../../../shared/hooks/useClickOutside'
import {cx, Icon, IconButton} from '@/ui/primitives'

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
 * Dropdown menu for card actions. The trigger is the Reverie `IconButton`
 * (a single option renders a labelled icon button directly); the menu panel
 * keeps the ink surface + click-outside / keyboard / focus management.
 */
export function CardOptions({
                                options,
                                align = 'right',
                                className = '',
                                disabled = false,
                                'aria-label': ariaLabel = 'Card options'
                            }: CardOptionsProps) {
    const [isOpen, setIsOpen] = useState(false)
    // Fixed-viewport coords for the portaled menu (anchored to the trigger).
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
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

    // Anchor the menu to the trigger in viewport space. The menu is portaled to
    // <body>, so it escapes the card's `overflow-hidden` + hover-transform; we
    // position it with `position: fixed` from the button rect, clamping inside
    // the viewport and flipping above the trigger when there is no room below.
    const updatePosition = useCallback(() => {
        const btn = buttonRef.current
        if (!btn) return
        const rect = btn.getBoundingClientRect()
        const menu = menuRef.current
        const menuW = menu?.offsetWidth || 180
        const menuH = menu?.offsetHeight || 0
        const gap = 8
        const margin = 8
        let left = align === 'left' ? rect.left : rect.right - menuW
        left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin))
        let top = rect.bottom + gap
        if (top + menuH > window.innerHeight - margin && rect.top - gap - menuH > margin) {
            top = rect.top - gap - menuH
        }
        setCoords({top, left})
    }, [align])

    // Enhanced menu management
    const openMenu = useCallback(() => {
        if (disabled) return
        updatePosition()
        setIsOpen(true)
        // Focus first item after animation
        setTimeout(() => {
            itemRefs.current[0]?.focus()
        }, 150)
    }, [disabled, updatePosition])

    const closeMenu = useCallback(() => {
        setIsOpen(false)
        buttonRef.current?.focus()
    }, [])

    // Keep the menu pinned to the trigger while it is open.
    useEffect(() => {
        if (!isOpen) return
        const onReflow = () => updatePosition()
        window.addEventListener('scroll', onReflow, true)
        window.addEventListener('resize', onReflow)
        return () => {
            window.removeEventListener('scroll', onReflow, true)
            window.removeEventListener('resize', onReflow)
        }
    }, [isOpen, updatePosition])

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
            delete: <Icon icon={Trash2} size={15}/>,
            edit: <Icon icon={Pencil} size={15}/>,
            start: <Icon icon={Play} size={15}/>,
            open: <Icon icon={ExternalLink} size={15}/>,
            custom: null
        }
        return iconMap[type]
    }, [])

    if (options.length === 0) return null

    // Single option → labelled icon button (no menu).
    if (options.length === 1) {
        const option = options[0]
        const isDisabled = disabled || option.disabled

        return (
            <IconButton
                size="sm"
                tone={option.danger ? 'danger' : 'default'}
                className={className}
                onClick={(e) => {
                    e.stopPropagation()
                    if (!isDisabled) {
                        option.onClick()
                    }
                }}
                disabled={isDisabled}
                label={option.label}
                data-testid="card-option-single"
            >
                {option.icon || getIcon(option.type)}
            </IconButton>
        )
    }

    const menuId = `card-options-menu-${Math.random().toString(36).substr(2, 9)}`

    return (
        <div className={cx('relative', className)}>
            <IconButton
                ref={buttonRef}
                id="card-options-button"
                size="sm"
                onClick={toggleMenu}
                disabled={disabled}
                label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                data-testid="card-options-button"
            >
                <Icon icon={MoreVertical} size={16}/>
            </IconButton>

            {createPortal(
            <div
                ref={menuRef}
                id={menuId}
                style={{position: 'fixed', top: coords?.top ?? 0, left: coords?.left ?? 0}}
                className={cx(
                    'z-[100] min-w-[180px] overflow-hidden rounded-lg border border-parchment-50/10 bg-ink-700 shadow-lg transition-opacity',
                    isOpen ? 'visible opacity-100' : 'invisible opacity-0',
                )}
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="card-options-button"
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
                            className={cx(
                                'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium leading-tight transition-colors hover:bg-parchment-50/5 disabled:cursor-not-allowed disabled:opacity-50',
                                isDanger ? 'text-blood-500 hover:bg-blood-500/15' : 'text-parchment-200 hover:text-parchment-50',
                                isHighlight && !isDanger && 'text-ember-300 font-semibold',
                            )}
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
                                <span className="flex w-5 flex-shrink-0 items-center justify-center" aria-hidden="true">
                                    {icon}
                                </span>
                            )}
                            <span>{option.label}</span>
                        </button>
                    )
                })}
            </div>,
            document.body,
            )}
        </div>
    )
}
