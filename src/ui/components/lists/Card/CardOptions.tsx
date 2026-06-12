import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react'
import { useClickOutside } from '../../../../shared/hooks/useClickOutside'
import { cx, Icon, IconButton } from '@/ui/primitives'

export type CardOptionType = 'open' | 'edit' | 'start' | 'delete' | 'custom'

export interface CardOptionBase {
    type: CardOptionType
    label: string
    onClick: () => void
    disabled?: boolean
    icon?: ReactNode
    danger?: boolean
    separatorBefore?: boolean
}

export interface CustomCardOption extends Omit<CardOptionBase, 'type'> {
    type: 'custom'
    icon: ReactNode
}

export type CardOption = CardOptionBase | CustomCardOption

export interface CardMenuAnchor {
    top: number
    left: number
}

interface CardActionMenuProps {
    options: CardOption[]
    open: boolean
    anchor: CardMenuAnchor | null
    disabled?: boolean
    labelledBy?: string
    menuId?: string
    menuTestId?: string
    optionTestIdPrefix?: string
    excludeRefs?: Array<RefObject<HTMLElement>>
    returnFocusRef?: RefObject<HTMLElement>
    onClose: () => void
}

interface CardOptionsProps {
    options: CardOption[]
    align?: 'left' | 'right'
    className?: string
    disabled?: boolean
    forceMenu?: boolean
    triggerIcon?: ReactNode
    triggerTestId?: string
    menuTestId?: string
    optionTestIdPrefix?: string
    onOpenChange?: (isOpen: boolean) => void
    'aria-label'?: string
}

const MENU_WIDTH = 216
const MENU_GAP = 8
const VIEWPORT_MARGIN = 8

function clampAnchor(anchor: CardMenuAnchor, menu: HTMLDivElement | null): CardMenuAnchor {
    if (typeof window === 'undefined') return anchor
    const width = menu?.offsetWidth || MENU_WIDTH
    const height = menu?.offsetHeight || 0
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN
    const maxTop = window.innerHeight - height - VIEWPORT_MARGIN
    return {
        left: Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft)),
        top: Math.max(VIEWPORT_MARGIN, Math.min(anchor.top, maxTop)),
    }
}

function iconForOption(type: CardOptionType): ReactNode {
    const iconMap: Record<CardOptionType, ReactNode> = {
        delete: <Icon icon={Trash2} size={15} />,
        edit: <Icon icon={Pencil} size={15} />,
        start: <Icon icon={Play} size={15} />,
        open: <Icon icon={ExternalLink} size={15} />,
        custom: null,
    }
    return iconMap[type]
}

function nextEnabledIndex(options: CardOption[], currentIndex: number, direction: 1 | -1): number {
    if (options.length === 0) return -1
    let next = currentIndex
    for (let i = 0; i < options.length; i += 1) {
        next = (next + direction + options.length) % options.length
        if (!options[next].disabled) return next
    }
    return -1
}

export function CardActionMenu({
    options,
    open,
    anchor,
    disabled = false,
    labelledBy,
    menuId,
    menuTestId = 'card-options-menu',
    optionTestIdPrefix = 'card-option',
    excludeRefs,
    returnFocusRef,
    onClose,
}: CardActionMenuProps) {
    const fallbackId = useId()
    const resolvedMenuId = menuId ?? `card-action-menu-${fallbackId}`
    const menuRef = useRef<HTMLDivElement>(null!)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
    const [coords, setCoords] = useState<CardMenuAnchor | null>(anchor)

    const closeMenu = useCallback(() => {
        onClose()
        returnFocusRef?.current?.focus()
    }, [onClose, returnFocusRef])

    useClickOutside(
        menuRef,
        () => {
            if (open) closeMenu()
        },
        excludeRefs,
    )

    useLayoutEffect(() => {
        if (!open || !anchor) return
        setCoords(clampAnchor(anchor, menuRef.current))
    }, [anchor, open])

    useEffect(() => {
        if (!open) return
        const firstEnabled = options.findIndex((option) => !option.disabled)
        const timer = window.setTimeout(() => {
            itemRefs.current[firstEnabled >= 0 ? firstEnabled : 0]?.focus()
        }, 0)
        return () => window.clearTimeout(timer)
    }, [open, options])

    useEffect(() => {
        if (!open) return
        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case 'Escape':
                    event.preventDefault()
                    closeMenu()
                    break
                case 'ArrowDown':
                case 'ArrowUp': {
                    event.preventDefault()
                    const currentIndex = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement)
                    const fallback = event.key === 'ArrowDown' ? -1 : 0
                    const next = nextEnabledIndex(options, currentIndex >= 0 ? currentIndex : fallback, event.key === 'ArrowDown' ? 1 : -1)
                    if (next >= 0) itemRefs.current[next]?.focus()
                    break
                }
                case 'Home': {
                    event.preventDefault()
                    const next = options.findIndex((option) => !option.disabled)
                    if (next >= 0) itemRefs.current[next]?.focus()
                    break
                }
                case 'End': {
                    event.preventDefault()
                    const next = options
                        .map((option, index) => ({ option, index }))
                        .reverse()
                        .find(({ option }) => !option.disabled)?.index
                    if (next !== undefined) itemRefs.current[next]?.focus()
                    break
                }
                case 'Tab':
                    closeMenu()
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [closeMenu, open, options])

    if (!open || !anchor || options.length === 0 || typeof document === 'undefined') return null

    const renderedCoords = coords ?? anchor

    return createPortal(
        <div
            ref={menuRef}
            id={resolvedMenuId}
            style={{ position: 'fixed', top: renderedCoords.top, left: renderedCoords.left }}
            className="z-[100] min-w-[216px] max-w-[min(260px,calc(100vw-16px))] overflow-hidden rounded-lg border border-parchment-50/10 bg-ink-800/95 py-1 shadow-xl ring-1 ring-ink-900/60 backdrop-blur-md"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby={labelledBy}
            data-testid={menuTestId}
        >
            {options.map((option, index) => {
                const icon = option.icon || iconForOption(option.type)
                const isDanger = option.danger || option.type === 'delete'
                const isHighlight = ['start', 'open', 'edit'].includes(option.type)
                const isDisabled = disabled || option.disabled

                return (
                    <button
                        key={`${option.type}-${option.label}-${index}`}
                        ref={(el) => {
                            itemRefs.current[index] = el
                        }}
                        className={cx(
                            'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left font-ui text-[13px] font-semibold leading-tight transition-colors hover:bg-parchment-50/[.06] disabled:cursor-not-allowed disabled:opacity-45',
                            option.separatorBefore && 'mt-1 border-t border-parchment-50/[.08]',
                            isDanger ? 'text-blood-500 hover:bg-blood-500/15' : 'text-parchment-200 hover:text-parchment-50',
                            isHighlight && !isDanger && 'text-ember-300',
                        )}
                        onClick={(event) => {
                            event.stopPropagation()
                            if (isDisabled) return
                            option.onClick()
                            closeMenu()
                        }}
                        disabled={isDisabled}
                        role="menuitem"
                        tabIndex={0}
                        data-danger={isDanger ? '' : undefined}
                        data-highlight={isHighlight ? '' : undefined}
                        aria-label={option.label}
                        type="button"
                        data-testid={`${optionTestIdPrefix}-${option.type}`}
                    >
                        {icon && (
                            <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden="true">
                                {icon}
                            </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                )
            })}
        </div>,
        document.body,
    )
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
    forceMenu = false,
    triggerIcon,
    triggerTestId = 'card-options-button',
    menuTestId = 'card-options-menu',
    optionTestIdPrefix = 'card-option',
    onOpenChange,
    'aria-label': ariaLabel = 'Card options',
}: CardOptionsProps) {
    const id = useId()
    const buttonId = `card-options-button-${id}`
    const menuId = `card-options-menu-${id}`
    const [isOpen, setIsOpen] = useState(false)
    const [anchor, setAnchor] = useState<CardMenuAnchor | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null!)

    const buttonAnchor = useCallback((): CardMenuAnchor | null => {
        const button = buttonRef.current
        if (!button) return null
        const rect = button.getBoundingClientRect()
        return {
            top: rect.bottom + MENU_GAP,
            left: align === 'left' ? rect.left : rect.right - MENU_WIDTH,
        }
    }, [align])

    const closeMenu = useCallback(() => {
        setIsOpen(false)
        onOpenChange?.(false)
    }, [onOpenChange])

    const openMenu = useCallback(() => {
        if (disabled) return
        const nextAnchor = buttonAnchor()
        if (!nextAnchor) return
        setAnchor(nextAnchor)
        setIsOpen(true)
        onOpenChange?.(true)
    }, [buttonAnchor, disabled, onOpenChange])

    useEffect(() => {
        if (!isOpen) return
        const onReflow = () => {
            const nextAnchor = buttonAnchor()
            if (nextAnchor) setAnchor(nextAnchor)
        }
        window.addEventListener('scroll', onReflow, true)
        window.addEventListener('resize', onReflow)
        return () => {
            window.removeEventListener('scroll', onReflow, true)
            window.removeEventListener('resize', onReflow)
        }
    }, [buttonAnchor, isOpen])

    if (options.length === 0) return null

    if (options.length === 1 && !forceMenu) {
        const option = options[0]
        const isDisabled = disabled || option.disabled

        return (
            <IconButton
                size="sm"
                tone={option.danger ? 'danger' : 'default'}
                className={className}
                onClick={(event) => {
                    event.stopPropagation()
                    if (!isDisabled) option.onClick()
                }}
                disabled={isDisabled}
                label={option.label}
                data-testid="card-option-single"
            >
                {option.icon || iconForOption(option.type)}
            </IconButton>
        )
    }

    return (
        <div className={cx('relative', className)}>
            <IconButton
                ref={buttonRef}
                id={buttonId}
                size="sm"
                onClick={(event) => {
                    event.stopPropagation()
                    if (isOpen) closeMenu()
                    else openMenu()
                }}
                disabled={disabled}
                label={ariaLabel}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                data-testid={triggerTestId}
            >
                {triggerIcon || <Icon icon={MoreVertical} size={16} />}
            </IconButton>

            <CardActionMenu
                options={options}
                open={isOpen}
                anchor={anchor}
                disabled={disabled}
                labelledBy={buttonId}
                menuId={menuId}
                menuTestId={menuTestId}
                optionTestIdPrefix={optionTestIdPrefix}
                excludeRefs={[buttonRef as RefObject<HTMLElement>]}
                returnFocusRef={buttonRef as RefObject<HTMLElement>}
                onClose={closeMenu}
            />
        </div>
    )
}
