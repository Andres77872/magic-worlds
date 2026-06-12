import { BookOpen } from 'lucide-react'
import { resolveMediaUrl } from '@/infrastructure/api'
import { Card as DomainCard } from '@/ui/components/lists/Card'
import { Icon, Modal, Tag } from '@/ui/primitives'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'
import { formatApiDateTime } from '@/utils/time'
import { cardPreviewTypeLabel, type CardPreview, type CardPreviewTarget } from '../cardPreview'

export interface CardPreviewModalProps {
    target: CardPreviewTarget | null
    card: CardPreview | null
    loading: boolean
    error: string | null
    onClose: () => void
}

function formatDateTime(value?: string | null): string {
    return formatApiDateTime(value)
}

function CardMetadata({ card }: { card: CardPreview }) {
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
                    {createdAt && <Tag>Created {createdAt}</Tag>}
                    {updatedAt && updatedAt !== createdAt && <Tag>Updated {updatedAt}</Tag>}
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

export function CardPreviewModal({ target, card, loading, error, onClose }: CardPreviewModalProps) {
    const isOpen = Boolean(target)
    const fallbackTitle = target?.fallbackName || (target ? cardPreviewTypeLabel(target.type) : 'Card')

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            title="Card"
            icon={<Icon icon={BookOpen} size={18} className="text-arcane-300" />}
        >
            {loading ? (
                <LoadingSpinner size="small" message="Loading card..." />
            ) : card ? (
                <div className="flex flex-col gap-4">
                    <DomainCard
                        title={card.title}
                        imageUrl={resolveMediaUrl(card.imageUrl)}
                        themeSongUrl={resolveMediaUrl(card.themeSongUrl)}
                        subtitle={<Tag>{card.badge || cardPreviewTypeLabel(card.type)}</Tag>}
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
                        {error || 'This card is no longer available in the current library.'}
                    </p>
                    {target && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Tag>{cardPreviewTypeLabel(target.type)}</Tag>
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
