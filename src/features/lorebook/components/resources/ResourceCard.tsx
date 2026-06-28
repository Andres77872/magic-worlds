import { FileText, Sparkles, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LorebookResource } from '@/shared'
import { Badge, Card, CardDeletingOverlay, Icon, IconButton, Tag, cx } from '@/ui/primitives'
import { CARD_ACTION_REVEAL_CLASS } from '@/ui/components/lists/Card'
import { lorebookResourceCompletedExtraction } from '../../lorebookResources'
import { Stat } from './Stat'
import { statusTone } from './resourceStatus'

interface ResourceCardProps {
    resource: LorebookResource
    deleting: boolean
    /** Open the resource's dedicated view (read mode). */
    onOpen: () => void
    onDelete: () => void
}

/**
 * Grid card for one resource: a stretched button opens its dedicated view; the
 * delete control sits above that button so it stays independently clickable.
 */
export function ResourceCard({ resource, deleting, onOpen, onDelete }: ResourceCardProps) {
    const { t } = useTranslation()
    const extraction = lorebookResourceCompletedExtraction(resource)
    const snippets = extraction?.snippets ?? []
    const name = resource.title || resource.fileName
    return (
        <Card className={cx('group relative flex min-h-[260px] flex-col overflow-hidden', deleting && 'pointer-events-none opacity-60')}>
            <button
                type="button"
                onClick={onOpen}
                aria-label={t('lorebookResourcesGallery.card.openAria', { name })}
                className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none"
            />
            <div className="pointer-events-none flex min-h-[112px] flex-col justify-between border-b border-parchment-50/[.08] bg-gradient-to-br from-arcane-500/15 via-arcane-500/10 to-ink-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-parchment-50/10 bg-ink-900/50 text-arcane-300">
                        <Icon icon={FileText} size={20} />
                    </span>
                    <div className={cx('pointer-events-auto relative z-[2] flex items-center gap-1.5', CARD_ACTION_REVEAL_CLASS)}>
                        <IconButton label={t('lorebookResourcesGallery.card.deleteAria', { name })} size="sm" tone="danger" onClick={onDelete}>
                            <Icon icon={Trash2} size={14} />
                        </IconButton>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(resource)}>{resource.extractionStatus ?? 'pending'}</Badge>
                    {resource.metadataOutdated && <Badge tone="ember">{t('lorebookResourcesGallery.card.outdated')}</Badge>}
                    <Tag>{resource.fileType.toUpperCase()}</Tag>
                </div>
            </div>
            <div className="pointer-events-none flex flex-1 flex-col gap-3 p-4">
                <div>
                    <h3 className="truncate font-display text-xl font-semibold leading-tight text-parchment-50" title={name}>
                        {name}
                    </h3>
                    <p className="mt-1 line-clamp-3 min-h-[54px] font-narrative text-sm leading-snug text-parchment-300">
                        {extraction?.shortSummary || resource.description || t('lorebookResourcesGallery.card.noDescription')}
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <Stat label={t('lorebookResourcesGallery.card.triggers')} value={String(resource.triggers.length)} />
                    <Stat label={t('lorebookResourcesGallery.card.snippets')} value={String(snippets.length)} />
                    <Stat label={t('lorebookResourcesGallery.card.links')} value={String(resource.linkCount ?? 0)} />
                </div>
                {snippets.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5">
                        <Badge tone="arcane" icon={<Icon icon={Sparkles} size={11} />}>
                            {t('lorebookResourcesGallery.card.snippetCount', { count: snippets.length })}
                        </Badge>
                    </div>
                )}
            </div>
            {deleting && <CardDeletingOverlay label={t('lorebookResourcesGallery.card.deleting')} />}
        </Card>
    )
}
