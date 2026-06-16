/**
 * CodexCardPickerDrawer — multi-select card browser for the codex: kind tabs,
 * debounced server search, "In codex" badges for cards already cloned. Adding
 * sends only kind+cardId; the backend clones the snapshot server-side.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Search } from 'lucide-react'
import type { CardMediaTargetType, StoryCardKind } from '@/shared'
import { useCardPickerOptions } from '@/features/gallery/media/hooks/useCardPickerOptions'
import { AuthenticatedImage, Button, Drawer, Icon, Tag, cx } from '@/ui/primitives'
import { KIND_ICONS, KIND_META } from '../../utils/codexUtils'

const PICKER_KINDS: CardMediaTargetType[] = ['character', 'world', 'item', 'adventure_template']
const PICKER_LIMIT = 24

interface CodexCardPickerDrawerProps {
    open: boolean
    busy: boolean
    existingCardKeys: Set<string>
    onClose: () => void
    onAdd: (cards: Array<{ kind: StoryCardKind; cardId: string }>) => Promise<void>
}

export function CodexCardPickerDrawer({ open, busy, existingCardKeys, onClose, onAdd }: CodexCardPickerDrawerProps) {
    const { t } = useTranslation()
    const [kind, setKind] = useState<CardMediaTargetType>('character')
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<Map<string, { kind: StoryCardKind; cardId: string }>>(new Map())
    const { options, loading } = useCardPickerOptions(kind, query, open, PICKER_LIMIT)

    const close = () => {
        setSelected(new Map())
        setQuery('')
        onClose()
    }

    const toggle = (optionKind: CardMediaTargetType, cardId: string) => {
        const key = `${optionKind}:${cardId}`
        setSelected((prev) => {
            const next = new Map(prev)
            if (next.has(key)) next.delete(key)
            else next.set(key, { kind: optionKind, cardId })
            return next
        })
    }

    const submit = async () => {
        await onAdd(Array.from(selected.values()))
        close()
    }

    return (
        <Drawer
            open={open}
            onClose={close}
            eyebrow={t('novelEditor.codex.title')}
            title={t('novelEditor.cardPicker.title')}
            size="lg"
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" onClick={close} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void submit()}
                        disabled={busy || selected.size === 0}
                        data-testid="codex-add-cards-submit"
                    >
                        {busy
                            ? t('novelEditor.cardPicker.adding')
                            : selected.size > 0
                              ? t('novelEditor.cardPicker.addCount', { count: selected.size })
                              : t('novelEditor.cardPicker.add')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="m-0 font-ui text-xs text-parchment-400">
                    {t('novelEditor.cardPicker.hint')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {PICKER_KINDS.map((pickerKind) => {
                        const meta = KIND_META.find((item) => item.kind === pickerKind)
                        const active = kind === pickerKind
                        return (
                            <button
                                key={pickerKind}
                                type="button"
                                onClick={() => setKind(pickerKind)}
                                aria-pressed={active}
                                className={cx(
                                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-ui text-xs font-medium transition-all',
                                    active
                                        ? 'border-ember-500/45 bg-ember-500/15 text-ember-300'
                                        : 'border-parchment-50/[.08] bg-ink-600 text-parchment-300 hover:border-parchment-50/20 hover:text-parchment-100',
                                )}
                            >
                                <Icon icon={KIND_ICONS[pickerKind]} size={13} />
                                {meta ? t(meta.pluralKey) : pickerKind}
                            </button>
                        )
                    })}
                </div>
                <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3 text-parchment-400">
                        <Icon icon={Search} size={15} />
                    </span>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('novelEditor.cardPicker.searchPlaceholder')}
                        aria-label={t('novelEditor.cardPicker.searchPlaceholder')}
                        className="w-full rounded-md border border-parchment-50/10 bg-ink-800 py-2 pl-9 pr-9 font-ui text-sm text-parchment-50 placeholder:text-parchment-500 focus:outline-none focus:border-ember-500"
                        data-testid="codex-card-search"
                    />
                    {loading && <Loader2 size={15} className="absolute right-3 animate-spin text-ember-500" aria-hidden="true" />}
                </div>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {options.map((option) => {
                        const key = `${option.type}:${option.id}`
                        const inCodex = existingCardKeys.has(key)
                        const isSelected = selected.has(key)
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    onClick={() => !inCodex && toggle(option.type, option.id)}
                                    disabled={inCodex}
                                    aria-pressed={isSelected}
                                    className={cx(
                                        'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                        inCodex
                                            ? 'cursor-default border-parchment-50/[.06] opacity-55'
                                            : isSelected
                                              ? 'cursor-pointer border-ember-500/45 bg-ember-500/10'
                                              : 'cursor-pointer border-parchment-50/10 hover:border-parchment-50/25 hover:bg-parchment-50/[.04]',
                                    )}
                                    data-testid="codex-card-option"
                                >
                                    {option.imageUrl ? (
                                        <AuthenticatedImage src={option.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                                    ) : (
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-800 text-parchment-500">
                                            <Icon icon={KIND_ICONS[option.type]} size={14} />
                                        </span>
                                    )}
                                    <span className="min-w-0 flex-1 truncate font-ui text-sm text-parchment-100">{option.name}</span>
                                    {inCodex ? (
                                        <Tag className="shrink-0">{t('novelEditor.codex.inCodex')}</Tag>
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            className={cx(
                                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                                isSelected
                                                    ? 'border-ember-500 bg-ember-500 text-on-ember'
                                                    : 'border-parchment-50/25 text-transparent',
                                            )}
                                        >
                                            <Icon icon={Check} size={13} />
                                        </span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                    {options.length === 0 && !loading && (
                        <li className="px-2 py-4 text-center font-ui text-xs text-parchment-500">{t('novelEditor.cardPicker.noMatches')}</li>
                    )}
                </ul>
            </div>
        </Drawer>
    )
}
