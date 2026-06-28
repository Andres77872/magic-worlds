/**
 * LorebookPreviewBody — read-only overview of a lorebook for a floating preview
 * window. It shows manual entries plus extracted resource summaries/snippets.
 */
import { useTranslation } from 'react-i18next'
import { BookOpenText, FileText } from 'lucide-react'
import { Badge, Icon, IconTile, Tag } from '@/ui/primitives'
import type { Lorebook } from '@/shared'
import { lorebookResourceCompletedExtraction, lorebookResourcesFromMetadata } from '../lorebookResources'

interface LorebookPreviewBodyProps {
    lorebook: Lorebook
}

export function LorebookPreviewBody({ lorebook }: LorebookPreviewBodyProps) {
    const { t } = useTranslation()
    const resources = lorebookResourcesFromMetadata(lorebook.metadata)
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
                <IconTile icon={BookOpenText} tone="arcane" size="sm" />
                <div className="min-w-0 flex-1">
                    <p className="m-0 font-display text-[18px] font-semibold leading-tight text-parchment-50">{lorebook.name}</p>
                    <p className="m-0 mt-0.5 font-ui text-xs text-parchment-400">
                        {t('sessionLorebooks.entryResourceCount', { entries: lorebook.entries.length, resources: resources.length })}
                    </p>
                </div>
            </div>
            {lorebook.description && (
                <p className="m-0 font-narrative text-sm leading-relaxed text-parchment-400">{lorebook.description}</p>
            )}
            {lorebook.entries.length === 0 && resources.length === 0 ? (
                <p className="m-0 font-ui text-xs text-parchment-400">{t('floatingWindows.noEntries')}</p>
            ) : (
                <>
                    {lorebook.entries.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {lorebook.entries.map((entry) => (
                                <div key={entry.id} className="rounded-md border border-parchment-50/10 bg-ink-900/35 px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="min-w-0 flex-1 truncate font-ui text-sm font-semibold text-parchment-100">{entry.title}</span>
                                        <Tag>{entry.entryType}</Tag>
                                    </div>
                                    {entry.keys.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {entry.keys.slice(0, 6).map((key) => (
                                                <Tag key={key}>{key}</Tag>
                                            ))}
                                            {entry.keys.length > 6 && <Tag>+{entry.keys.length - 6}</Tag>}
                                        </div>
                                    )}
                                    {entry.content && (
                                        <p className="m-0 mt-1.5 line-clamp-3 font-narrative text-xs leading-snug text-parchment-400">
                                            {entry.content}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {resources.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 font-ui text-xs font-semibold text-parchment-300">
                                <Icon icon={FileText} size={13} className="text-arcane-300" />
                                {t('floatingWindows.resources', { count: resources.length })}
                            </div>
                            {resources.slice(0, 4).map((resource) => {
                                const extraction = lorebookResourceCompletedExtraction(resource)
                                return (
                                    <div key={resource.id} className="rounded-md border border-arcane-500/20 bg-arcane-500/[.06] px-3 py-2.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="min-w-0 flex-1 truncate font-ui text-sm font-semibold text-parchment-100">{resource.title || resource.fileName}</span>
                                            <Badge tone={resource.extractionStatus === 'completed' ? 'live' : resource.extractionStatus === 'failed' ? 'danger' : 'arcane'}>
                                                {resource.extractionStatus ?? 'pending'}
                                            </Badge>
                                        </div>
                                        {extraction?.shortSummary && (
                                            <p className="m-0 mt-1.5 line-clamp-3 font-narrative text-xs leading-snug text-parchment-400">
                                                {extraction.shortSummary}
                                            </p>
                                        )}
                                        {extraction?.snippets.length ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {extraction.snippets.slice(0, 3).map((snippet) => (
                                                    <Tag key={snippet.id ?? snippet.title}>{snippet.title}</Tag>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                )
                            })}
                            {resources.length > 4 && <p className="m-0 font-ui text-xs text-parchment-400">+{resources.length - 4}</p>}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
