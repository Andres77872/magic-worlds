/**
 * Reverie Select — themed replacement for the native <select>. The trigger
 * shares the form-control look; the option list renders in a body portal so
 * the dark candlelit popup survives overflow/sticky containers and stacks
 * above Drawer/Modal overlays (same approach as CardActionMenu).
 *
 * Follows the APG select-only combobox pattern: DOM focus stays on the
 * trigger, the active option is conveyed via aria-activedescendant.
 */
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
    type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import { cx } from './cx'
import { Icon } from './Icon'
import { controlBaseClass } from './Field'
import { useFieldContext } from './fieldContext'
import { useAnchoredPopup } from './useAnchoredPopup'

export interface SelectOption {
    value: string
    label: ReactNode
    /** Plain text used for type-ahead matching when `label` is rich. */
    textValue?: string
    description?: string
    disabled?: boolean
}

export type SelectSize = 'sm' | 'md'

interface SelectProps {
    options: readonly SelectOption[]
    value: string | null | undefined
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    size?: SelectSize
    id?: string
    className?: string
    'aria-label'?: string
}

const SIZE_CLASS: Record<SelectSize, string> = {
    sm: 'px-3 py-2 text-[13px]',
    md: 'px-3.5 py-2.5 text-[15px]',
}

function optionText(option: SelectOption): string {
    if (option.textValue) return option.textValue
    return typeof option.label === 'string' ? option.label : option.value
}

export function Select({
    options,
    value,
    onChange,
    placeholder = 'Select…',
    disabled = false,
    size = 'md',
    id,
    className,
    'aria-label': ariaLabel,
}: SelectProps) {
    const ctx = useFieldContext()
    const reactId = useId()
    const triggerId = id ?? ctx?.id ?? `select-${reactId}`
    const listboxId = `${triggerId}-listbox`

    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)

    const triggerRef = useRef<HTMLButtonElement>(null!)
    const listRef = useRef<HTMLDivElement>(null!)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])
    const typeBufferRef = useRef('')
    const typeTimerRef = useRef<number | null>(null)

    const { position, clearPosition } = useAnchoredPopup(open, triggerRef, listRef, options)

    const selectedIndex = options.findIndex((option) => option.value === value)
    const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

    const close = useCallback(() => {
        setOpen(false)
        clearPosition()
    }, [clearPosition])

    const openPopup = useCallback(() => {
        if (disabled || options.length === 0) return
        const firstEnabled = options.findIndex((option) => !option.disabled)
        const start = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : firstEnabled
        setActiveIndex(start)
        setOpen(true)
        // Keyboard handling lives on the trigger; some browsers (Safari) do
        // not focus buttons on click, so claim focus explicitly.
        triggerRef.current?.focus()
    }, [disabled, options, selectedIndex])

    const commit = useCallback(
        (index: number) => {
            const option = options[index]
            if (!option || option.disabled) return
            onChange(option.value)
            close()
        },
        [close, onChange, options],
    )

    const moveActive = useCallback(
        (direction: 1 | -1) => {
            setActiveIndex((current) => {
                let next = current
                for (let i = 0; i < options.length; i += 1) {
                    next += direction
                    if (next < 0 || next >= options.length) return current
                    if (!options[next].disabled) return next
                }
                return current
            })
        },
        [options],
    )

    const setEdgeActive = useCallback(
        (edge: 'first' | 'last') => {
            const enabled = options
                .map((option, index) => ({ option, index }))
                .filter(({ option }) => !option.disabled)
            if (enabled.length === 0) return
            setActiveIndex(edge === 'first' ? enabled[0].index : enabled[enabled.length - 1].index)
        },
        [options],
    )

    const typeAhead = useCallback(
        (char: string) => {
            if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current)
            typeBufferRef.current += char.toLowerCase()
            typeTimerRef.current = window.setTimeout(() => {
                typeBufferRef.current = ''
            }, 500)
            const buffer = typeBufferRef.current
            const start = buffer.length === 1 ? activeIndex + 1 : Math.max(activeIndex, 0)
            for (let i = 0; i < options.length; i += 1) {
                const index = (start + i) % options.length
                const option = options[index]
                if (option.disabled) continue
                if (optionText(option).toLowerCase().startsWith(buffer)) {
                    setActiveIndex(index)
                    return
                }
            }
        },
        [activeIndex, options],
    )

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return
        const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
        if (!open) {
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Home', 'End'].includes(event.key) || event.key === ' ' || printable) {
                event.preventDefault()
                openPopup()
                if (printable) typeAhead(event.key)
            }
            return
        }
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault()
                moveActive(1)
                break
            case 'ArrowUp':
                event.preventDefault()
                moveActive(-1)
                break
            case 'Home':
                event.preventDefault()
                setEdgeActive('first')
                break
            case 'End':
                event.preventDefault()
                setEdgeActive('last')
                break
            case 'Enter':
            case ' ':
                event.preventDefault()
                commit(activeIndex)
                break
            case 'Escape':
                // Swallow Esc so a surrounding Drawer/Modal stays open.
                event.preventDefault()
                event.stopPropagation()
                close()
                break
            case 'Tab':
                close()
                break
            default:
                if (printable) {
                    event.preventDefault()
                    typeAhead(event.key)
                }
        }
    }

    useEffect(() => {
        if (!open || activeIndex < 0) return
        itemRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
    }, [activeIndex, open])

    useEffect(() => {
        return () => {
            if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current)
        }
    }, [])

    const outsideRefs = useMemo(
        () => [triggerRef, listRef] as Array<RefObject<HTMLElement>>,
        [],
    )
    useClickOutside(outsideRefs, () => {
        if (open) close()
    })

    const activeOptionId = open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                id={triggerId}
                disabled={disabled}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-activedescendant={activeOptionId}
                aria-label={ariaLabel}
                aria-invalid={ctx?.invalid || undefined}
                className={cx(
                    controlBaseClass,
                    SIZE_CLASS[size],
                    'flex cursor-pointer items-center justify-between gap-2 text-left',
                    className,
                )}
                onClick={() => (open ? close() : openPopup())}
                onKeyDown={handleKeyDown}
            >
                <span className={cx('min-w-0 flex-1 truncate', !selected && 'text-parchment-400')}>
                    {selected ? selected.label : placeholder}
                </span>
                <Icon icon={ChevronsUpDown} size={15} className="shrink-0 text-parchment-400" />
            </button>
            {open && typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        aria-labelledby={ariaLabel ? undefined : triggerId}
                        aria-label={ariaLabel}
                        style={{
                            position: 'fixed',
                            top: position?.top ?? -9999,
                            left: position?.left ?? -9999,
                            width: position?.width,
                        }}
                        className="z-[100] max-h-80 overflow-y-auto rounded-md border border-parchment-50/10 bg-ink-800 py-1 shadow-lg"
                    >
                        {options.map((option, index) => {
                            const isSelected = option.value === value
                            const isActive = index === activeIndex
                            return (
                                <div
                                    key={option.value}
                                    ref={(el) => {
                                        itemRefs.current[index] = el
                                    }}
                                    id={`${listboxId}-option-${index}`}
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-disabled={option.disabled || undefined}
                                    className={cx(
                                        'flex items-start justify-between gap-2 px-3 py-2 font-ui text-[14px]',
                                        option.disabled
                                            ? 'cursor-not-allowed opacity-45'
                                            : 'cursor-pointer',
                                        isSelected ? 'bg-ember-500/15 text-ember-300' : 'text-parchment-100',
                                        isActive && !isSelected && 'bg-parchment-50/[.06]',
                                        isActive && isSelected && 'bg-ember-500/25',
                                    )}
                                    onPointerDown={(event) => event.preventDefault()}
                                    onPointerEnter={() => {
                                        if (!option.disabled) setActiveIndex(index)
                                    }}
                                    onClick={() => commit(index)}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate">{option.label}</span>
                                        {option.description && (
                                            <span className="mt-0.5 block text-[12px] leading-snug text-parchment-300">
                                                {option.description}
                                            </span>
                                        )}
                                    </span>
                                    {isSelected && (
                                        <Icon icon={Check} size={14} className="mt-0.5 shrink-0 text-ember-400" />
                                    )}
                                </div>
                            )
                        })}
                    </div>,
                    document.body,
                )}
        </>
    )
}
