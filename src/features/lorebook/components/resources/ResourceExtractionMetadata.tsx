import { AlertTriangle, Clock3, FileText, Hash, Sparkles, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LorebookResource } from '@/shared'
import { Badge, Callout, Icon, SectionHeader, Tag, cx } from '@/ui/primitives'
import { formatApiDateTime } from '@/utils/time'
import { lorebookResourceCompletedExtraction } from '../../lorebookResources'

interface ResourceExtractionMetadataProps {
    resource: LorebookResource
}

export function ResourceExtractionMetadata({ resource }: ResourceExtractionMetadataProps) {
    const { t } = useTranslation()
    const extraction = lorebookResourceCompletedExtraction(resource)
    const status = resource.extractionStatus ?? 'pending'
    const updatedAt = formatApiDateTime(extraction?.updatedAt)

    const heading = t('lorebookResourcesGallery.metadata.heading')

    if (!extraction) {
        return (
            <section className="grid gap-3 rounded-lg border border-arcane-500/20 bg-arcane-500/[.06] px-4 py-4">
                <SectionHeader icon={FileText} tone="arcane" title={heading} />
                <p className="m-0 font-ui text-sm text-parchment-300">
                    {status === 'failed'
                        ? t('lorebookResourcesGallery.metadata.failed')
                        : t('lorebookResourcesGallery.metadata.pending')}
                </p>
            </section>
        )
    }

    return (
        <section className="grid gap-4 rounded-lg border border-arcane-500/20 bg-arcane-500/[.06] px-4 py-4">
            <SectionHeader
                icon={FileText}
                tone="arcane"
                title={heading}
                right={
                    <div className="flex flex-wrap gap-2">
                        {updatedAt && (
                            <Badge tone="arcane" icon={<Icon icon={Clock3} size={11} />}>
                                {t('lorebookResourcesGallery.metadata.updated', { date: updatedAt })}
                            </Badge>
                        )}
                        {extraction.model && (
                            <Badge tone="neutral" icon={<Icon icon={Hash} size={11} />}>
                                {extraction.model}
                            </Badge>
                        )}
                        {extraction.schemaVersion && <Badge tone="neutral">{extraction.schemaVersion}</Badge>}
                    </div>
                }
            />

            {resource.metadataOutdated && (
                <Callout tone="warning" icon={<Icon icon={AlertTriangle} size={14} />} role="status">
                    {t('lorebookResourcesGallery.metadata.outdated')}
                </Callout>
            )}

            {extraction.shortSummary && (
                <div className="grid gap-1.5">
                    <span className="font-ui text-xs font-semibold text-arcane-300">{t('lorebookResourcesGallery.metadata.shortSummary')}</span>
                    <p className="m-0 font-narrative text-sm leading-relaxed text-parchment-200">{extraction.shortSummary}</p>
                </div>
            )}

            {extraction.longSummary && extraction.longSummary !== extraction.shortSummary && (
                <div className="grid gap-1.5">
                    <span className="font-ui text-xs font-semibold text-arcane-300">{t('lorebookResourcesGallery.metadata.longSummary')}</span>
                    <p className="m-0 font-narrative text-sm leading-relaxed text-parchment-300">{extraction.longSummary}</p>
                </div>
            )}

            {extraction.keywords.length > 0 && (
                <div className="grid gap-2">
                    <span className="inline-flex items-center gap-1.5 font-ui text-xs font-semibold text-arcane-300">
                        <Icon icon={Tags} size={13} />
                        {t('lorebookResourcesGallery.metadata.keywords')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {extraction.keywords.map((keyword) => <Tag key={keyword}>{keyword}</Tag>)}
                    </div>
                </div>
            )}

            {extraction.notes && extraction.notes.length > 0 && (
                <div className="grid gap-2">
                    <span className="font-ui text-xs font-semibold text-arcane-300">{t('lorebookResourcesGallery.metadata.notes')}</span>
                    <div className="grid gap-1.5">
                        {extraction.notes.map((note, index) => (
                            <p key={`${note}-${index}`} className="m-0 rounded-md bg-ink-900/35 px-3 py-2 font-ui text-xs text-parchment-300">
                                {note}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {extraction.snippets.length > 0 && (
                <div className="grid gap-2">
                    <span className="inline-flex items-center gap-1.5 font-ui text-xs font-semibold text-arcane-300">
                        <Icon icon={Sparkles} size={13} />
                        {t('lorebookResourcesGallery.metadata.snippets')}
                    </span>
                    <div className="grid gap-2 lg:grid-cols-2">
                        {extraction.snippets.map((snippet, index) => (
                            <article key={snippet.id ?? `${snippet.title}-${index}`} className="grid gap-2 rounded-md border border-parchment-50/[.08] bg-ink-900/35 px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate font-ui text-sm font-semibold text-parchment-100" title={snippet.title}>
                                        {snippet.title}
                                    </span>
                                    {snippet.source && <span className="font-mono text-caption text-parchment-500">{snippet.source}</span>}
                                </div>
                                <p className={cx('m-0 font-narrative text-sm leading-relaxed text-parchment-300', snippet.content.length > 360 && 'line-clamp-5')}>
                                    {snippet.content}
                                </p>
                                {snippet.triggers.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {snippet.triggers.map((trigger) => <Tag key={trigger}>{trigger}</Tag>)}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}
