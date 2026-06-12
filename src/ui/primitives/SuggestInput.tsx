/**
 * Reverie SuggestInput — a creatable combobox: a normal text input whose value
 * is always free text, with a portal listbox of described suggestions the user
 * can pick instead of typing. Used for fields like race, genre, or item type
 * where examples teach the field but must never constrain it.
 *
 * Follows the APG editable-combobox pattern: DOM focus stays on the input, the
 * active option is conveyed via aria-activedescendant.
 */
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useClickOutside } from '../../shared/hooks/useClickOutside'
import { cx } from './cx'
import { Icon } from './Icon'
import { controlBaseClass } from './Field'
import { useFieldContext } from './fieldContext'
import { useAnchoredPopup } from './useAnchoredPopup'
import type { SelectOption, SelectSize } from './Select'

export interface SuggestInputProps {
    value: string
    onChange: (value: string) => void
    /** Suggestions; `description` renders as example text under each label. */
    options: readonly SelectOption[]
    placeholder?: string
    id?: string
    size?: SelectSize
    disabled?: boolean
    className?: string
    autoFocus?: boolean
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

export function SuggestInput({
    value,
    onChange,
    options,
    placeholder,
    id,
    size = 'md',
    disabled = false,
    className,
    autoFocus,
    'aria-label': ariaLabel,
}: SuggestInputProps) {
    const ctx = useFieldContext()
    const reactId = useId()
    const inputId = id ?? ctx?.id ?? `suggest-${reactId}`
    const listboxId = `${inputId}-listbox`

    const [open, setOpen] = useState(false)
    const [rawActiveIndex, setActiveIndex] = useState(-1)

    const inputRef = useRef<HTMLInputElement>(null!)
    const listRef = useRef<HTMLDivElement>(null!)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])

    // Show everything until the user types; then narrow by substring so a
    // half-typed custom value still surfaces near matches.
    const filtered = useMemo(() => {
        const query = value.trim().toLowerCase()
        if (!query) return options
        return options.filter(
            (option) =>
                !option.disabled &&
                (optionText(option).toLowerCase().includes(query) ||
                    option.value.toLowerCase().includes(query)),
        )
    }, [options, value])

    const { position, clearPosition } = useAnchoredPopup(open, inputRef, listRef, filtered)

    // Typing can narrow the list below the highlighted row — derive, don't sync.
    const activeIndex = rawActiveIndex < filtered.length ? rawActiveIndex : -1

    const close = useCallback(() => {
        setOpen(false)
        setActiveIndex(-1)
        clearPosition()
    }, [clearPosition])

    const openPopup = useCallback(() => {
        if (disabled || options.length === 0) return
        setOpen(true)
    }, [disabled, options.length])

    const commit = useCallback(
        (index: number) => {
            const option = filtered[index]
            if (!option || option.disabled) return
            onChange(option.value)
            close()
        },
        [close, filtered, onChange],
    )

    const moveActive = (direction: 1 | -1) => {
        if (filtered.length === 0) return
        let next = activeIndex + direction
        if (next < -1) next = filtered.length - 1
        if (next >= filtered.length) next = -1 // wrap through "nothing highlighted"
        setActiveIndex(next)
    }

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (disabled) return
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault()
                if (!open) openPopup()
                else moveActive(1)
                break
            case 'ArrowUp':
                event.preventDefault()
                if (!open) openPopup()
                else moveActive(-1)
                break
            case 'Enter':
                if (open) {
                    // Selecting a suggestion must not submit the surrounding form;
                    // Enter with nothing highlighted just dismisses the popup.
                    event.preventDefault()
                    if (activeIndex >= 0) commit(activeIndex)
                    else close()
                }
                break
            case 'Escape':
                if (open) {
                    // Swallow Esc so a surrounding Drawer/Modal/creator stays open.
                    event.preventDefault()
                    event.stopPropagation()
                    close()
                }
                break
            case 'Tab':
                close()
                break
        }
    }

    useEffect(() => {
        if (!open || activeIndex < 0) return
        itemRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
    }, [activeIndex, open])

    const outsideRefs = useMemo(
        () => [inputRef, listRef] as Array<RefObject<HTMLElement>>,
        [],
    )
    useClickOutside(outsideRefs, () => {
        if (open) close()
    })

    const activeOptionId = open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
    const showList = open && filtered.length > 0

    return (
        <>
            <input
                ref={inputRef}
                type="text"
                id={inputId}
                value={value}
                disabled={disabled}
                autoFocus={autoFocus}
                placeholder={placeholder}
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={showList}
                aria-controls={showList ? listboxId : undefined}
                aria-activedescendant={activeOptionId}
                aria-label={ariaLabel}
                aria-invalid={ctx?.invalid || undefined}
                autoComplete="off"
                className={cx(controlBaseClass, SIZE_CLASS[size], className)}
                onChange={(event) => {
                    onChange(event.target.value)
                    if (!open) openPopup()
                    setActiveIndex(-1)
                }}
                onFocus={openPopup}
                onClick={() => {
                    if (!open) openPopup()
                }}
                onKeyDown={handleKeyDown}
            />
            {showList && typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        aria-label={ariaLabel ?? 'Suggestions'}
                        style={{
                            position: 'fixed',
                            top: position?.top ?? -9999,
                            left: position?.left ?? -9999,
                            width: position?.width,
                        }}
                        className="z-[100] max-h-80 overflow-y-auto rounded-md border border-parchment-50/10 bg-ink-800 py-1 shadow-lg"
                    >
                        {filtered.map((option, index) => {
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
                                    className={cx(
                                        'flex items-start justify-between gap-2 px-3 py-2 font-ui text-[14px] cursor-pointer',
                                        isSelected ? 'bg-ember-500/15 text-ember-300' : 'text-parchment-100',
                                        isActive && !isSelected && 'bg-parchment-50/[.06]',
                                        isActive && isSelected && 'bg-ember-500/25',
                                    )}
                                    onPointerDown={(event) => event.preventDefault()}
                                    onPointerEnter={() => setActiveIndex(index)}
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
