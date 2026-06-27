import { useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { BookOpen, EyeOff, FileText, KeyRound, Link2, ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Lorebook } from '@/shared'
import { Badge, Card, CardDeletingOverlay, Icon, Tag, cx } from '@/ui/primitives'
import { CardActionMenu, CardOptions, type CardOption, useCardActionContextMenu } from '@/ui/components'
import { CARD_ACTION_REVEAL_CLASS } from '@/ui/components/lists/Card'
import { lorebookResourceStats, lorebookResourcesFromMetadata } from '../lorebookResources'
import { Stat } from './resources/Stat'

interface LorebookCardProps {
    lorebook: Lorebook
    options?: CardOption[]
    onClick?: () => void
    onTagClick?: (tag: string) => void
    deleting?: boolean
    /** `card` (default) — the stat-rich tile. `row` — a compact list row. */
    view?: 'card' | 'row'
}

export function LorebookCard({ lorebook, options, onClick, onTagClick, deleting = false, view = 'card' }: LorebookCardProps) {
    const { t } = useTranslation()
    const enabledEntries = lorebook.entries.filter((entry) => entry.enabled).length
    const secretEntries = lorebook.entries.filter((entry) => entry.isSecret).length
    const keyCount = lorebook.entries.reduce((sum, entry) => sum + entry.keys.length, 0)
    const resourceStats = lorebookResourceStats(lorebookResourcesFromMetadata(lorebook.metadata))
    const interactive = Boolean(onClick) && !deleting
    const cardRef = useRef<HTMLDivElement>(null!)
    const cardOptions = options ?? []
    const contextMenu = useCardActionContextMenu({
        options: cardOptions,
        disabled: deleting,
        returnFocusRef: cardRef,
    })

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (contextMenu.handleContextMenuKeyDown(event)) return
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onClick()
        }
    }

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        if (contextMenu.suppressClickAfterLongPress(event)) return
        onClick?.()
    }

    const rootHandlers = {
        onClick: interactive ? handleClick : undefined,
        onKeyDown: interactive || cardOptions.length > 0 ? handleKeyDown : undefined,
        onContextMenu: contextMenu.handleContextMenu,
        onPointerDown: contextMenu.pointerHandlers.onPointerDown,
        onPointerMove: contextMenu.pointerHandlers.onPointerMove,
        onPointerCancel: contextMenu.pointerHandlers.onPointerCancel,
        onPointerLeave: contextMenu.pointerHandlers.onPointerLeave,
        onPointerUp: contextMenu.pointerHandlers.onPointerUp,
    }

    if (view === 'row') {
        const visibleTags = lorebook.tags.slice(0, 2)
        return (
            <Card
                ref={cardRef}
                interactive={interactive}
                role={interactive ? 'button' : 'article'}
                tabIndex={interactive || cardOptions.length > 0 ? 0 : undefined}
                {...rootHandlers}
                aria-label={t('lorebookGallery.card.openAria', { name: lorebook.name })}
                aria-busy={deleting || undefined}
                className={cx('group relative flex w-full items-center gap-3 p-2.5 sm:gap-4 sm:p-3', deleting && 'pointer-events-none opacity-60')}
                data-testid="lorebook-card"
            >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-parchment-50/10 bg-gradient-to-br from-arcane-500/20 to-ink-900/40 text-arcane-300">
                    <Icon icon={BookOpen} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <h3 className="m-0 min-w-0 truncate font-display text-[17px] font-semibold leading-tight text-parchment-50" title={lorebook.name}>
                            {lorebook.name}
                        </h3>
                        <Badge tone={lorebook.enabled ? 'live' : 'neutral'} className="hidden shrink-0 sm:inline-flex">
                            {lorebook.enabled ? t('lorebookGallery.card.enabled') : t('lorebookGallery.card.disabled')}
                        </Badge>
                        {secretEntries > 0 && (
                            <Badge tone="nsfw" icon={<Icon icon={EyeOff} size={11} />} className="hidden shrink-0 sm:inline-flex">
                                {t('lorebookGallery.card.secret', { count: secretEntries })}
                            </Badge>
                        )}
                    </div>
                    <p className="m-0 truncate font-narrative text-label leading-snug text-parchment-300">
                        {lorebook.description || t('lorebookGallery.card.noDescription')}
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 font-ui text-micro text-parchment-400">
                        <span className="inline-flex items-center gap-1" title={t('lorebookGallery.card.entries')}>
                            <Icon icon={ScrollText} size={12} className="text-arcane-300" />
                            {enabledEntries}/{lorebook.entries.length}
                        </span>
                        <span className="inline-flex items-center gap-1" title={t('lorebookGallery.card.keys')}>
                            <Icon icon={KeyRound} size={12} className="text-arcane-300" />
                            {keyCount}
                        </span>
                        <span className="inline-flex items-center gap-1" title={t('lorebookGallery.card.resources')}>
                            <Icon icon={FileText} size={12} className="text-arcane-300" />
                            {resourceStats.completed}/{resourceStats.total}
                        </span>
                        <span className="inline-flex items-center gap-1" title={t('lorebookGallery.card.targets')}>
                            <Icon icon={Link2} size={12} className="text-parchment-300" />
                            {lorebook.attachments.length}
                        </span>
                        {visibleTags.map((tag) =>
                            onTagClick ? (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onTagClick(tag)
                                    }}
                                    className="max-w-[40%] shrink cursor-pointer truncate whitespace-nowrap rounded-full bg-ink-600 px-2 py-[2px] font-semibold text-parchment-200 transition-colors hover:bg-ember-500/25 hover:text-ember-300"
                                >
                                    {tag}
                                </button>
                            ) : (
                                <Tag key={tag} className="max-w-[40%] shrink truncate whitespace-nowrap">
                                    {tag}
                                </Tag>
                            ),
                        )}
                    </div>
                </div>
                {cardOptions.length > 0 && (
                    <div className={cx('flex shrink-0 items-center', CARD_ACTION_REVEAL_CLASS)} onClick={(event) => event.stopPropagation()}>
                        <CardOptions options={cardOptions} aria-label={t('lorebookGallery.card.actionsAria', { name: lorebook.name })} />
                    </div>
                )}
                {deleting && <CardDeletingOverlay label={t('lorebookGallery.card.deleting')} />}
                <CardActionMenu
                    {...contextMenu.menuProps}
                    menuTestId="card-context-menu"
                    optionTestIdPrefix="card-context-option"
                />
            </Card>
        )
    }

    return (
        <Card
            ref={cardRef}
            interactive={interactive}
            role={interactive ? 'button' : 'article'}
            tabIndex={interactive || cardOptions.length > 0 ? 0 : undefined}
            {...rootHandlers}
            aria-label={t('lorebookGallery.card.openAria', { name: lorebook.name })}
            aria-busy={deleting || undefined}
            className={cx('group relative flex min-h-[280px] flex-col', deleting && 'pointer-events-none opacity-60')}
            data-testid="lorebook-card"
        >
            <div className="flex min-h-[132px] flex-col justify-between border-b border-parchment-50/[.08] bg-gradient-to-br from-arcane-500/15 via-arcane-500/10 to-ink-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-parchment-50/10 bg-ink-900/50 text-arcane-300">
                        <Icon icon={BookOpen} size={21} />
                    </span>
                    <div className={cx('flex items-center gap-1.5', CARD_ACTION_REVEAL_CLASS)} onClick={(event) => event.stopPropagation()}>
                        {cardOptions.length > 0 && <CardOptions options={cardOptions} aria-label={t('lorebookGallery.card.actionsAria', { name: lorebook.name })} />}
                    </div>
                </div>
                <div>
                    <div className="flex flex-wrap gap-2">
                        <Badge tone={lorebook.enabled ? 'live' : 'neutral'}>{lorebook.enabled ? t('lorebookGallery.card.enabled') : t('lorebookGallery.card.disabled')}</Badge>
                        {secretEntries > 0 && (
                            <Badge tone="nsfw" icon={<Icon icon={EyeOff} size={11} />}>{t('lorebookGallery.card.secret', { count: secretEntries })}</Badge>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-4">
                <div>
                    <h3 className="truncate font-display text-xl font-semibold leading-tight text-parchment-50" title={lorebook.name}>
                        {lorebook.name}
                    </h3>
                    <p className="mt-1 line-clamp-3 min-h-[54px] font-narrative text-sm leading-snug text-parchment-300">
                        {lorebook.description || t('lorebookGallery.card.noDescription')}
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Stat
                        icon={<Icon icon={ScrollText} size={13} className="text-arcane-300" />}
                        label={t('lorebookGallery.card.entries')}
                        value={`${enabledEntries}/${lorebook.entries.length}`}
                    />
                    <Stat
                        icon={<Icon icon={KeyRound} size={13} className="text-arcane-300" />}
                        label={t('lorebookGallery.card.keys')}
                        value={String(keyCount)}
                    />
                    <Stat
                        icon={<Icon icon={FileText} size={13} className="text-arcane-300" />}
                        label={t('lorebookGallery.card.resources')}
                        value={`${resourceStats.completed}/${resourceStats.total}`}
                    />
                    <Stat
                        icon={<Icon icon={Link2} size={13} className="text-parchment-300" />}
                        label={t('lorebookGallery.card.targets')}
                        value={String(lorebook.attachments.length)}
                    />
                </div>
                {lorebook.tags.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5">
                        {lorebook.tags.slice(0, 3).map((tag) =>
                            onTagClick ? (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onTagClick(tag)
                                    }}
                                    className="cursor-pointer rounded-full bg-ink-900/60 px-2 py-[2px] font-ui text-micro font-semibold text-parchment-200 transition-colors hover:bg-ember-500/25 hover:text-ember-300"
                                >
                                    {tag}
                                </button>
                            ) : (
                                <Tag key={tag}>{tag}</Tag>
                            ),
                        )}
                        {lorebook.tags.length > 3 && (
                            <Tag className="bg-ink-900/60 text-parchment-300">+{lorebook.tags.length - 3}</Tag>
                        )}
                    </div>
                )}
            </div>
            {deleting && <CardDeletingOverlay label={t('lorebookGallery.card.deleting')} />}
            <CardActionMenu
                {...contextMenu.menuProps}
                menuTestId="card-context-menu"
                optionTestIdPrefix="card-context-option"
            />
        </Card>
    )
}
