/**
 * CardPicker — a searchable card combobox for the media gallery's
 * "filter by card" control. Closed: a pill trigger showing the picked card (or
 * a placeholder) with an inline clear. Open: a small panel with a debounced
 * search input and a keyboard-navigable listbox of cards scoped to the active
 * card-type filter.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Globe, Loader2, Search, Swords, Users, X } from 'lucide-react'
import type { CardMediaTargetType } from '@/shared'
import { useClickOutside } from '@/shared/hooks'
import { cx, Icon } from '@/ui/primitives'
import type { CardRef, CardTypeFilter } from '../mediaGalleryTypes'
import { useCardPickerOptions } from '../hooks/useCardPickerOptions'

const TYPE_ICON: Record<CardMediaTargetType, typeof Users> = {
    character: Users,
    world: Globe,
    adventure_template: Swords,
}

export interface CardPickerProps {
    /** Scopes the option list; "all" searches every card type. */
    cardType: CardTypeFilter
    value?: CardRef
    onChange: (card: CardRef | undefined) => void
}

export function CardPicker({ cardType, value, onChange }: CardPickerProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null!)
    const inputRef = useRef<HTMLInputElement>(null)
    const { options, loading } = useCardPickerOptions(cardType, query, open)

    useClickOutside(rootRef, () => setOpen(false))

    useEffect(() => {
        if (open) inputRef.current?.focus()
        else setQuery('')
    }, [open])

    // Keep the roving highlight on a real option as results change.
    useEffect(() => {
        setActiveIndex((prev) => Math.min(prev, Math.max(options.length - 1, 0)))
    }, [options])

    const pick = (card: CardRef) => {
        onChange(card)
        setOpen(false)
    }

    const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((prev) => Math.min(prev + 1, options.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((prev) => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const option = options[activeIndex]
            if (option) pick(option)
        }
    }

    return (
        <div ref={rootRef} className="relative">
            <div
                className={cx(
                    'inline-flex items-center gap-1 rounded-full border transition-all',
                    value
                        ? 'border-ember-500/45 bg-ember-500/15 text-ember-300'
                        : 'border-parchment-50/[.08] bg-ink-600 text-parchment-200 hover:border-parchment-50/20 hover:text-parchment-50',
                )}
            >
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-label="Filter by card"
                    onClick={() => setOpen((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1.5 py-1.5 pl-3 font-ui text-[12.5px] font-medium"
                    data-testid="card-picker-trigger"
                >
                    {value ? (
                        <>
                            <Icon icon={TYPE_ICON[value.type]} size={13} />
                            <span className="max-w-[160px] truncate">{value.name ?? value.id}</span>
                        </>
                    ) : (
                        <>
                            <Icon icon={Search} size={13} />
                            Filter by card
                        </>
                    )}
                    {!value && <Icon icon={ChevronDown} size={13} className={cx('transition-transform', open && 'rotate-180')} />}
                </button>
                {value ? (
                    <button
                        type="button"
                        aria-label="Clear card filter"
                        onClick={() => onChange(undefined)}
                        className="mr-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-ember-500/25"
                        data-testid="card-picker-clear"
                    >
                        <Icon icon={X} size={12} />
                    </button>
                ) : (
                    <span className="w-2" aria-hidden="true" />
                )}
            </div>

            {open && (
                <div
                    className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-parchment-50/10 bg-ink-700 p-2 shadow-xl"
                    data-testid="card-picker-panel"
                >
                    <div className="relative mb-1 flex items-center">
                        <span className="pointer-events-none absolute left-2.5 text-parchment-400">
                            <Icon icon={Search} size={14} />
                        </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                setActiveIndex(0)
                            }}
                            onKeyDown={onInputKeyDown}
                            placeholder="Search your cards…"
                            aria-label="Search your cards"
                            className="w-full rounded-md border border-parchment-50/10 bg-ink-800 py-2 pl-8 pr-8 font-ui text-sm text-parchment-50 placeholder:text-parchment-500 focus:outline-none"
                            data-testid="card-picker-search"
                        />
                        {loading && (
                            <Loader2 size={14} className="absolute right-2.5 animate-spin text-ember-500" aria-hidden="true" />
                        )}
                    </div>
                    <ul role="listbox" aria-label="Cards" className="flex max-h-72 flex-col overflow-y-auto">
                        {options.map((option, index) => (
                            <li key={`${option.type}:${option.id}`} role="presentation">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={value?.id === option.id && value?.type === option.type}
                                    onClick={() => pick(option)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cx(
                                        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                                        index === activeIndex ? 'bg-ink-600' : 'hover:bg-ink-600/60',
                                    )}
                                    data-testid="card-picker-option"
                                >
                                    {option.imageUrl ? (
                                        <img src={option.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                                    ) : (
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-800 text-parchment-500">
                                            <Icon icon={TYPE_ICON[option.type]} size={13} />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1 truncate font-ui text-sm text-parchment-100">{option.name}</span>
                                    <Icon icon={TYPE_ICON[option.type]} size={12} className="shrink-0 text-parchment-500" />
                                </button>
                            </li>
                        ))}
                        {options.length === 0 && !loading && (
                            <li className="px-2 py-3 text-center font-ui text-xs text-parchment-500" role="presentation">
                                No cards match.
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    )
}
