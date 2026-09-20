/**
 * CardPicker — a searchable card combobox for the media gallery's
 * "filter by card" control. Closed: a pill trigger showing the picked card (or
 * a placeholder) with an inline clear. Open: a small panel with a debounced
 * search input and a keyboard-navigable listbox of cards scoped to the active
 * card-type filter.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAnchoredPopup } from '@/ui/primitives/useAnchoredPopup'
import { useDismissableLayer } from '@/ui/primitives/useDismissableLayer'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Gem, Globe, Loader2, Search, Swords, Users, X } from 'lucide-react'
import type { CardMediaTargetType } from '@/shared'
import { useClickOutside } from '@/shared/hooks'
import { AuthenticatedImage, controlClass, cx, Icon } from '@/ui/primitives'
import type { CardRef, CardTypeFilter } from '../mediaGalleryTypes'
import { useCardPickerOptions } from '../hooks/useCardPickerOptions'

const TYPE_ICON: Record<CardMediaTargetType, typeof Users> = {
    character: Users,
    world: Globe,
    item: Gem,
    adventure_template: Swords,
}

export interface CardPickerProps {
    /** Scopes the option list; "all" searches every card type. */
    cardType: CardTypeFilter
    value?: CardRef
    onChange: (card: CardRef | undefined) => void
}

export function CardPicker({ cardType, value, onChange }: CardPickerProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null!)
    const triggerRef = useRef<HTMLButtonElement>(null!)
    const popupRef = useRef<HTMLDivElement>(null!)
    const listboxId = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const { options, loading } = useCardPickerOptions(cardType, query, open)

    const { position } = useAnchoredPopup(open, triggerRef, popupRef, options, 288)
    useDismissableLayer({ open, onClose: () => setOpen(false), panelRef: popupRef, lockScroll: false, label: 'card-picker' })
    useClickOutside(rootRef, () => setOpen(false), [popupRef])

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
                        : 'border-line-faint bg-ink-600 text-parchment-200 hover:border-parchment-50/20 hover:text-parchment-50',
                )}
            >
                <button
                    type="button"
                    ref={triggerRef}
                    role="combobox"
                    aria-controls={open ? listboxId : undefined}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-label={t('mediaGallery.picker.filterByCard')}
                    onClick={() => setOpen((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1.5 py-1.5 pl-3 font-ui text-label font-medium"
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
                            {t('mediaGallery.picker.filterByCard')}
                        </>
                    )}
                    {!value && <Icon icon={ChevronDown} size={13} className={cx('transition-transform', open && 'rotate-180')} />}
                </button>
                {value ? (
                    <button
                        type="button"
                        aria-label={t('mediaGallery.picker.clearCardFilter')}
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

            {open && createPortal(
                <div
                    ref={popupRef}
                    style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999, width: position?.width }}
                    className="z-[100] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-lg border border-line-faint bg-ink-700 p-2 shadow-lg"
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
                            placeholder={t('mediaGallery.picker.searchPlaceholder')}
                            aria-label={t('mediaGallery.picker.searchLabel')}
                            className={cx(controlClass, 'py-2 pl-8 pr-8')}
                            data-testid="card-picker-search"
                        />
                        {loading && (
                            <Loader2 size={14} className="absolute right-2.5 animate-spin text-ember-500" aria-hidden="true" />
                        )}
                    </div>
                    <ul id={listboxId} role="listbox" aria-label={t('mediaGallery.picker.listboxLabel')} className="flex max-h-72 flex-col overflow-y-auto">
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
                                        <AuthenticatedImage src={option.imageUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
                                    ) : (
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-800 text-fg-subtle">
                                            <Icon icon={TYPE_ICON[option.type]} size={13} />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1 truncate font-ui text-sm text-parchment-100">{option.name}</span>
                                    <Icon icon={TYPE_ICON[option.type]} size={12} className="shrink-0 text-fg-subtle" />
                                </button>
                            </li>
                        ))}
                        {options.length === 0 && !loading && (
                            <li className="px-2 py-3 text-center font-ui text-xs text-fg-subtle" role="presentation">
                                {t('mediaGallery.picker.noMatches')}
                            </li>
                        )}
                    </ul>
                </div>, document.body,
            )}
        </div>
    )
}
