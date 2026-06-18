/**
 * CardPreviewBody — the read-only card renderer shared by the CardPreviewModal
 * and the floating preview windows: portrait + badge + description + metadata
 * (version/dates, usage, triggers, attributes), with loading and fallback
 * states. Kept free of any modal/window chrome so both surfaces render an
 * identical preview.
 */
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { resolveMediaUrl } from '@/infrastructure/api'
import type { VersionableCardType } from '@/shared'
import { useCardUsage } from '@/shared/hooks/useCardUsage'
import { Card as DomainCard } from '@/ui/components/lists/Card'
import { CardUsageLine } from '@/ui/components/common/CardUsageLine'
import { Badge, Tag } from '@/ui/primitives'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { formatApiDateTime } from '@/utils/time'
import type { CardPreview, CardPreviewTarget, CardPreviewTargetType } from '../cardPreview'

function formatDateTime(value?: string | null): string {
    return formatApiDateTime(value)
}

function localizedCardPreviewTypeLabel(type: CardPreviewTargetType, t: TFunction): string {
    return t(`cardPreview.types.${type}`)
}

function CardMetadata({ card, showUsage = false }: { card: CardPreview; showUsage?: boolean }) {
    const { t } = useTranslation()
    const createdAt = formatDateTime(card.createdAt)
    const updatedAt = formatDateTime(card.updatedAt)
    const showVersion = typeof card.versionNumber === 'number' && card.versionNumber > 0
    const usageType: VersionableCardType | null =
        card.mediaType === 'adventure_template' ? null : card.mediaType
    const usage = useCardUsage(usageType, card.id, { enabled: showUsage && usageType !== null })
    const attrs = (card.categories ?? [])
        .flatMap((category) => category.attributes ?? [])
        .flatMap((record) => Object.entries(record))
        .filter(([key, value]) => key && value)
        .slice(0, 5)

    return (
        <div className="flex flex-col gap-3">
            {(createdAt || updatedAt || showVersion) && (
                <div className="flex flex-wrap items-center gap-2">
                    {showVersion && <Tag>{t('cardVersions.drawer.versionLabel', { number: card.versionNumber })}</Tag>}
                    {createdAt && <Tag>{t('cardPreview.created', { date: createdAt })}</Tag>}
                    {updatedAt && updatedAt !== createdAt && <Tag>{t('cardPreview.updated', { date: updatedAt })}</Tag>}
                </div>
            )}
            {showUsage && <CardUsageLine usage={usage} />}
            {card.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {card.triggers.slice(0, 6).map((trigger) => (
                        <Tag key={trigger}>{trigger}</Tag>
                    ))}
                    {card.triggers.length > 6 && <Tag>+{card.triggers.length - 6}</Tag>}
                </div>
            )}
            {attrs.length > 0 && (
                <div className="grid gap-1.5">
                    {attrs.map(([key, value]) => (
                        <div
                            key={`${key}:${value}`}
                            className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] gap-2 rounded-md bg-ink-900/45 px-2.5 py-1.5"
                        >
                            <span className="truncate font-ui text-[11px] font-semibold text-parchment-400">{key}</span>
                            <span className="min-w-0 truncate font-ui text-[12px] text-parchment-100">{value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export interface CardPreviewBodyProps {
    card: CardPreview | null
    loading: boolean
    error: string | null
    /** Used to render id/type chips in the fallback (unavailable) state. */
    target?: CardPreviewTarget | null
    /** Owner-scoped usage line (own-library previews only). */
    showUsage?: boolean
    /** Render the "already in your library" badge above the card. */
    alreadyImported?: boolean
}

export function CardPreviewBody({
    card,
    loading,
    error,
    target = null,
    showUsage = false,
    alreadyImported = false,
}: CardPreviewBodyProps) {
    const { t } = useTranslation()

    if (loading) {
        return <LoadingSpinner size="small" message={t('cardPreview.loading')} />
    }

    if (card) {
        return (
            <div className="flex flex-col gap-4">
                {alreadyImported && <Badge tone="arcane">{t('gallery.preview.alreadyImported')}</Badge>}
                <DomainCard
                    title={card.title}
                    imageUrl={resolveMediaUrl(card.imageUrl)}
                    themeSongUrl={resolveMediaUrl(card.themeSongUrl)}
                    subtitle={<Tag>{card.badge || localizedCardPreviewTypeLabel(card.type, t)}</Tag>}
                >
                    <div className="flex flex-col gap-3">
                        {card.description && (
                            <p className="font-narrative text-sm leading-relaxed text-parchment-400">{card.description}</p>
                        )}
                        <CardMetadata card={card} showUsage={showUsage} />
                    </div>
                </DomainCard>
            </div>
        )
    }

    const fallbackTitle = target?.fallbackName || (target ? localizedCardPreviewTypeLabel(target.type, t) : t('cardPreview.fallback'))
    return (
        <div className="rounded-lg border border-parchment-50/10 bg-ink-800/60 p-4">
            <div className="font-ui text-sm font-semibold text-parchment-100">{fallbackTitle}</div>
            <p className="mt-2 font-ui text-xs leading-relaxed text-parchment-400">
                {error || t('cardPreview.unavailable')}
            </p>
            {target && (
                <div className="mt-3 flex flex-wrap gap-2">
                    <Tag>{localizedCardPreviewTypeLabel(target.type, t)}</Tag>
                    <span className="inline-flex items-center rounded-full bg-ink-600 px-2.5 py-[3px] font-mono text-[11px] text-parchment-200">
                        {target.id}
                    </span>
                </div>
            )}
        </div>
    )
}
