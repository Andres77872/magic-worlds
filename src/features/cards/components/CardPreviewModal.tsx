import { BookOpen, Import, Loader2 } from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { resolveMediaUrl } from '@/infrastructure/api'
import { Card as DomainCard } from '@/ui/components/lists/Card'
import { Badge, Button, Icon, Modal, Tag } from '@/ui/primitives'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { formatApiDateTime } from '@/utils/time'
import type { CardPreview, CardPreviewTarget } from '../cardPreview'

export interface CardPreviewModalProps {
    target: CardPreviewTarget | null
    card: CardPreview | null
    loading: boolean
    error: string | null
    onClose: () => void
    /** Original-author attribution shown above the import action. */
    originalCreatorName?: string | null
    /** When true, render the "already in your library" badge + "Open existing". */
    alreadyImported?: boolean
    /** In-flight import state for this card. */
    importing?: boolean
    /** Provide to render the import footer; omit for a read-only preview. */
    onImport?: () => void
    /** Navigate to the caller's existing copy (shown when alreadyImported). */
    onOpenExisting?: () => void
    importDisabled?: boolean
}

function formatDateTime(value?: string | null): string {
    return formatApiDateTime(value)
}

function localizedCardPreviewTypeLabel(type: CardPreview['type'] | CardPreviewTarget['type'], t: TFunction): string {
    return t(`cardPreview.types.${type}`)
}

function CardMetadata({ card }: { card: CardPreview }) {
    const { t } = useTranslation()
    const createdAt = formatDateTime(card.createdAt)
    const updatedAt = formatDateTime(card.updatedAt)
    const attrs = (card.categories ?? [])
        .flatMap((category) => category.attributes ?? [])
        .flatMap((record) => Object.entries(record))
        .filter(([key, value]) => key && value)
        .slice(0, 5)

    return (
        <div className="flex flex-col gap-3">
            {(createdAt || updatedAt) && (
                <div className="flex flex-wrap gap-2">
                    {createdAt && <Tag>{t('cardPreview.created', { date: createdAt })}</Tag>}
                    {updatedAt && updatedAt !== createdAt && <Tag>{t('cardPreview.updated', { date: updatedAt })}</Tag>}
                </div>
            )}
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

export function CardPreviewModal({
    target,
    card,
    loading,
    error,
    onClose,
    originalCreatorName,
    alreadyImported = false,
    importing = false,
    onImport,
    onOpenExisting,
    importDisabled = false,
}: CardPreviewModalProps) {
    const { t } = useTranslation()
    const isOpen = Boolean(target)
    const fallbackTitle = target?.fallbackName || (target ? localizedCardPreviewTypeLabel(target.type, t) : t('cardPreview.fallback'))

    const footer = onImport ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="min-w-0 truncate font-ui text-xs text-parchment-400">
                {originalCreatorName
                    ? t('gallery.preview.createdBy', { name: originalCreatorName })
                    : ''}
            </span>
            <div className="flex items-center gap-2">
                {alreadyImported && onOpenExisting && (
                    <Button variant="secondary" size="sm" onClick={onOpenExisting} disabled={importing}>
                        {t('gallery.preview.openExisting')}
                    </Button>
                )}
                <Button
                    variant="primary"
                    size="sm"
                    onClick={onImport}
                    disabled={importDisabled || importing}
                    iconLeft={
                        importing ? (
                            <Icon icon={Loader2} size={15} className="animate-spin" />
                        ) : (
                            <Icon icon={Import} size={15} />
                        )
                    }
                >
                    {importing
                        ? t('gallery.importing')
                        : alreadyImported
                          ? t('gallery.preview.importCopy')
                          : t('gallery.preview.import')}
                </Button>
            </div>
        </div>
    ) : undefined

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            title={t('cardPreview.title')}
            icon={<Icon icon={BookOpen} size={18} className="text-arcane-300" />}
            closeLabel={t('common.close')}
            footer={footer}
        >
            {loading ? (
                <LoadingSpinner size="small" message={t('cardPreview.loading')} />
            ) : card ? (
                <div className="flex flex-col gap-4">
                    {alreadyImported && (
                        <Badge tone="arcane">{t('gallery.preview.alreadyImported')}</Badge>
                    )}
                    <DomainCard
                        title={card.title}
                        imageUrl={resolveMediaUrl(card.imageUrl)}
                        themeSongUrl={resolveMediaUrl(card.themeSongUrl)}
                        subtitle={<Tag>{card.badge || localizedCardPreviewTypeLabel(card.type, t)}</Tag>}
                    >
                        <div className="flex flex-col gap-3">
                            {card.description && (
                                <p className="font-narrative text-sm leading-relaxed text-parchment-400">
                                    {card.description}
                                </p>
                            )}
                            <CardMetadata card={card} />
                        </div>
                    </DomainCard>
                </div>
            ) : (
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
            )}
        </Modal>
    )
}
