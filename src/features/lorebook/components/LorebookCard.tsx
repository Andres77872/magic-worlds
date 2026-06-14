import type { KeyboardEvent } from 'react'
import { BookOpen, EyeOff, KeyRound, Link2, ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Lorebook } from '@/shared'
import { Badge, Card, Icon, Tag, cx } from '@/ui/primitives'
import { CardOptions, type CardOption } from '@/ui/components'

interface LorebookCardProps {
    lorebook: Lorebook
    options?: CardOption[]
    onClick?: () => void
    onTagClick?: (tag: string) => void
    deleting?: boolean
}

export function LorebookCard({ lorebook, options, onClick, onTagClick, deleting = false }: LorebookCardProps) {
    const { t } = useTranslation()
    const enabledEntries = lorebook.entries.filter((entry) => entry.enabled).length
    const secretEntries = lorebook.entries.filter((entry) => entry.isSecret).length
    const keyCount = lorebook.entries.reduce((sum, entry) => sum + entry.keys.length, 0)
    const interactive = Boolean(onClick) && !deleting

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick?.()
        }
    }

    return (
        <Card
            interactive={interactive}
            role={interactive ? 'button' : 'article'}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? onClick : undefined}
            onKeyDown={interactive ? handleKeyDown : undefined}
            aria-label={t('lorebookGallery.card.openAria', { name: lorebook.name })}
            aria-busy={deleting || undefined}
            className={cx('group relative flex min-h-[280px] flex-col', deleting && 'pointer-events-none opacity-60')}
            data-testid="lorebook-card"
        >
            <div className="flex min-h-[132px] flex-col justify-between border-b border-parchment-50/[.08] bg-gradient-to-br from-ember-500/15 via-arcane-500/10 to-ink-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-parchment-50/10 bg-ink-900/50 text-ember-400">
                        <Icon icon={BookOpen} size={21} />
                    </span>
                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
                        {options && options.length > 0 && <CardOptions options={options} aria-label={t('lorebookGallery.card.actionsAria', { name: lorebook.name })} />}
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
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-ink-800 px-2.5 py-2">
                        <Icon icon={ScrollText} size={13} className="text-ember-400" />
                        <div className="mt-1 font-ui text-[11px] text-parchment-400">{t('lorebookGallery.card.entries')}</div>
                        <div className="font-display text-lg font-semibold text-parchment-50">{enabledEntries}/{lorebook.entries.length}</div>
                    </div>
                    <div className="rounded-md bg-ink-800 px-2.5 py-2">
                        <Icon icon={KeyRound} size={13} className="text-arcane-300" />
                        <div className="mt-1 font-ui text-[11px] text-parchment-400">{t('lorebookGallery.card.keys')}</div>
                        <div className="font-display text-lg font-semibold text-parchment-50">{keyCount}</div>
                    </div>
                    <div className="rounded-md bg-ink-800 px-2.5 py-2">
                        <Icon icon={Link2} size={13} className="text-parchment-300" />
                        <div className="mt-1 font-ui text-[11px] text-parchment-400">{t('lorebookGallery.card.targets')}</div>
                        <div className="font-display text-lg font-semibold text-parchment-50">{lorebook.attachments.length}</div>
                    </div>
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
                                    className="cursor-pointer rounded-full bg-ink-900/60 px-2 py-[2px] font-ui text-[10px] font-semibold text-parchment-200 transition-colors hover:bg-ember-500/25 hover:text-ember-300"
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
            {deleting && (
                <div className="absolute inset-0 z-[3] flex items-center justify-center bg-ink-900/70 font-medium text-parchment-50">
                    {t('lorebookGallery.card.deleting')}
                </div>
            )}
        </Card>
    )
}
