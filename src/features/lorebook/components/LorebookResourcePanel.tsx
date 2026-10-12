import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, FilePlus2, FileText, Library, Link2, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import type { LorebookResource } from '@/shared'
import { Badge, Button, Callout, Field, Icon, IconButton, Input, SwitchRow, Tag, Textarea, cx } from '@/ui/primitives'
import { TriggersField } from '@/features/creation/common/components'
import { LlmFeatureControl } from '@/features/llmProfiles/LlmFeatureControl'
import { authSession } from '@/infrastructure/api/authSession'
import {
    LOREBOOK_RESOURCE_ACCEPT,
    LOREBOOK_RESOURCE_MAX_CHARS,
    LOREBOOK_RESOURCE_MAX_RESOURCES,
    LOREBOOK_RESOURCE_MAX_TRIGGERS,
    invalidateLorebookResourceExtraction,
    isAllowedResourceFile,
    lorebookResourceCompletedExtraction,
    lorebookResourceStats,
    newLorebookResource,
    nextLorebookResourceFileName,
} from '../lorebookResources'
import { readLorebookResourceFile, resourceFileErrorKey } from '../lorebookResourceFiles'

interface LorebookResourcePanelProps {
    resources: LorebookResource[]
    onChange: (resources: LorebookResource[]) => void
    linkedResources?: LorebookResource[]
    onAddFromLibrary?: () => void
    onDetachResource?: (resource: LorebookResource) => void
    saving?: boolean
    pendingExtractionCount?: number
    extractMetadataOnSave?: boolean
    onExtractMetadataOnSaveChange?: (enabled: boolean) => void
    onImportingChange?: (importing: boolean) => void
}

function statusTone(resource: LorebookResource) {
    if (resource.extractionStatus === 'completed') return 'live'
    if (resource.extractionStatus === 'failed') return 'danger'
    return 'arcane'
}

export function LorebookResourcePanel({
    resources,
    onChange,
    linkedResources = [],
    onAddFromLibrary,
    onDetachResource,
    saving = false,
    pendingExtractionCount = 0,
    extractMetadataOnSave = false,
    onExtractMetadataOnSaveChange,
    onImportingChange,
}: LorebookResourcePanelProps) {
    const { t } = useTranslation()
    const inputRef = useRef<HTMLInputElement>(null)
    const [error, setError] = useState<string | null>(null)
    const [importing, setImporting] = useState(false)
    const busy = saving || importing
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const allResources = useMemo(() => [...linkedResources, ...resources], [linkedResources, resources])
    const stats = useMemo(() => lorebookResourceStats(allResources), [allResources])
    const canAdd = allResources.length < LOREBOOK_RESOURCE_MAX_RESOURCES
    const currentResources = useRef({ resources, linkedResources })
    const mounted = useRef(false)

    useEffect(() => { currentResources.current = { resources, linkedResources } }, [resources, linkedResources])
    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])

    useEffect(() => {
        setExpandedIds((current) => {
            const resourcesById = new Map(resources.map((resource) => [resource.id, resource]))
            const next = new Set<string>()
            current.forEach((id) => {
                const resource = resourcesById.get(id)
                if (resource && resource.extractionStatus !== 'completed') next.add(id)
            })
            return next
        })
    }, [resources])

    const expandResource = (id: string) => {
        setExpandedIds((current) => new Set(current).add(id))
    }

    const toggleResource = (id: string) => {
        setExpandedIds((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const updateResource = (id: string, changes: Partial<LorebookResource>) => {
        setError(null)
        expandResource(id)
        onChange(resources.map((resource) => (
            resource.id === id
                ? invalidateLorebookResourceExtraction(resource, changes)
                : resource
        )))
    }

    const removeResource = (id: string) => {
        setError(null)
        setExpandedIds((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
        })
        onChange(resources.filter((resource) => resource.id !== id))
    }

    const addManualResource = (fileType: 'md' | 'txt') => {
        setError(null)
        if (!canAdd) {
            setError(t('lorebookStudio.resources.errors.count', { count: LOREBOOK_RESOURCE_MAX_RESOURCES }))
            return
        }
        const fileName = nextLorebookResourceFileName(resources, fileType)
        const resource = newLorebookResource(fileName, '')
        onChange([...resources, resource])
        expandResource(resource.id)
    }

    const addFiles = async (files: FileList | null) => {
        setError(null)
        if (!files?.length || busy) return
        setImporting(true)
        onImportingChange?.(true)
        const owner = authSession.getSnapshot()
        const next: LorebookResource[] = []
        try {
            for (const file of Array.from(files)) {
                const current = currentResources.current
                if (current.resources.length + current.linkedResources.length + next.length >= LOREBOOK_RESOURCE_MAX_RESOURCES) {
                    setError(t('lorebookStudio.resources.errors.count', { count: LOREBOOK_RESOURCE_MAX_RESOURCES }))
                    break
                }
                if (!isAllowedResourceFile(file)) {
                    setError(t('lorebookResourcesGallery.errors.uploadFileType', { name: file.name }))
                    continue
                }
                try {
                    const resource = await readLorebookResourceFile(file)
                    if (!mounted.current || !authSession.isCurrent(owner)) return
                    if (resource.content.length > LOREBOOK_RESOURCE_MAX_CHARS) {
                        setError(t('lorebookStudio.resources.errors.size', { name: file.name, count: LOREBOOK_RESOURCE_MAX_CHARS }))
                        continue
                    }
                    next.push(resource)
                } catch (err) {
                    if (!mounted.current || !authSession.isCurrent(owner)) return
                    const key = resourceFileErrorKey(err)
                    setError(key ? t(key, { name: file.name }) : err instanceof Error ? err.message : t('lorebookResourcesGallery.errors.saveFailed'))
                }
            }
            if (next.length > 0) {
                const current = currentResources.current
                const available = Math.max(0, LOREBOOK_RESOURCE_MAX_RESOURCES - current.resources.length - current.linkedResources.length)
                const added = next.slice(0, available)
                if (added.length < next.length) setError(t('lorebookStudio.resources.errors.count', { count: LOREBOOK_RESOURCE_MAX_RESOURCES }))
                onChange([...current.resources, ...added])
                setExpandedIds((current) => {
                    const expanded = new Set(current)
                    added.forEach((resource) => expanded.add(resource.id))
                    return expanded
                })
            }
        } finally {
            if (mounted.current) {
                setImporting(false)
                onImportingChange?.(false)
                if (inputRef.current) inputRef.current.value = ''
            }
        }
    }

    return (
        <section aria-label={t('lorebookStudio.resources.heading')} data-testid="lorebook-resource-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Icon icon={FileText} size={16} className="text-arcane-300" />
                        <h3 className="font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.resources.heading')}</h3>
                    </div>
                    <p className="font-ui text-xs text-parchment-300">
                        {t('lorebookStudio.resources.subtitle', { count: allResources.length, max: LOREBOOK_RESOURCE_MAX_RESOURCES })}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={LOREBOOK_RESOURCE_ACCEPT}
                        multiple
                        className="sr-only"
                        aria-label={t('lorebookStudio.resources.uploadAria')}
                        data-testid="lorebook-resource-upload"
                        onChange={(event) => void addFiles(event.target.files)}
                        disabled={busy || !canAdd}
                    />
                    {onAddFromLibrary && (
                        <Button variant="secondary" size="sm" iconLeft={<Icon icon={Library} size={15} />} onClick={onAddFromLibrary} disabled={busy || !canAdd}>
                            {t('lorebookStudio.resources.addFromLibrary')}
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={FilePlus2} size={15} />} onClick={() => addManualResource('txt')} disabled={busy || !canAdd} data-testid="lorebook-resource-new-txt">
                        {t('lorebookStudio.resources.newText')}
                    </Button>
                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={FilePlus2} size={15} />} onClick={() => addManualResource('md')} disabled={busy || !canAdd}>
                        {t('lorebookStudio.resources.newMarkdown')}
                    </Button>
                    <Button variant="primary" size="sm" iconLeft={<Icon icon={Upload} size={15} />} onClick={() => inputRef.current?.click()} disabled={busy || !canAdd}>
                        {t('lorebookStudio.resources.upload')}
                    </Button>
                </div>
            </div>

            <Callout tone="info">{t('lorebookResourcesGallery.pdfImportHint')}</Callout>
            {importing && <Callout tone="info" role="status">{t('lorebookResourcesGallery.importingFiles')}</Callout>}
            {saving && extractMetadataOnSave && pendingExtractionCount > 0 && (
                <div className="border-b border-arcane-500/20 bg-arcane-500/[.08] px-4 py-3 font-ui text-sm text-parchment-200">
                    {t('lorebookStudio.resources.savingExtracting', { count: pendingExtractionCount })}
                </div>
            )}

            {onExtractMetadataOnSaveChange && (
                <div className="grid gap-3 border-b border-line py-4">
                    <SwitchRow
                        variant="plain"
                        label={t('lorebookStudio.resources.extractOnSave.label')}
                        description={t('lorebookStudio.resources.extractOnSave.description')}
                        checked={extractMetadataOnSave}
                        onChange={onExtractMetadataOnSaveChange}
                        disabled={busy}
                    />
                    {extractMetadataOnSave && (
                        <LlmFeatureControl feature="lorebook_extraction" disabled={busy} />
                    )}
                    {extractMetadataOnSave && (
                        <Callout tone="warning" role="note">
                            {pendingExtractionCount > 0
                                ? t('lorebookStudio.resources.extractOnSave.warning', { count: pendingExtractionCount })
                                : t('lorebookStudio.resources.extractOnSave.noPending')}
                        </Callout>
                    )}
                </div>
            )}

            {error && (
                <div className="border-b border-blood-500/30 bg-blood-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="alert">
                    {error}
                </div>
            )}

            {linkedResources.length > 0 && (
                <div className="divide-y divide-parchment-50/[.06] border-b border-parchment-50/[.08]">
                    <div className="flex items-center gap-2 px-4 py-3 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-parchment-400">
                        <Icon icon={Link2} size={13} className="text-arcane-300" />
                        {t('lorebookStudio.resources.sharedHeading', { count: linkedResources.length })}
                    </div>
                    {linkedResources.map((resource) => {
                        const extraction = lorebookResourceCompletedExtraction(resource)
                        return (
                            <section key={resource.id} className="grid gap-3 px-4 py-4" data-testid="lorebook-linked-resource-card">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="truncate font-ui text-sm font-semibold text-parchment-50">{resource.title || resource.fileName}</span>
                                            <Tag>{resource.fileType.toUpperCase()}</Tag>
                                            <Badge tone="arcane" icon={<Icon icon={Link2} size={11} />}>{t('lorebookStudio.resources.shared')}</Badge>
                                            <Badge tone={statusTone(resource)}>
                                                {t(`lorebookStudio.resources.status.${resource.extractionStatus ?? 'pending'}`)}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 font-ui text-xs text-parchment-400">
                                            {extraction?.shortSummary || resource.description || resource.fileName}
                                        </p>
                                    </div>
                                    {onDetachResource && (
                                        <IconButton
                                            label={t('lorebookStudio.resources.detach', { title: resource.title || resource.fileName })}
                                            size="sm"
                                            tone="danger"
                                            onClick={() => onDetachResource(resource)}
                                            disabled={busy}
                                        >
                                            <Icon icon={Trash2} size={14} />
                                        </IconButton>
                                    )}
                                </div>
                                <ResourceExtractionPreview resource={resource} />
                            </section>
                        )
                    })}
                </div>
            )}

            {allResources.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 px-6 text-center text-parchment-300">
                    <Icon icon={Plus} size={32} className="text-arcane-300" />
                    <div className="grid gap-1">
                        <span className="font-display text-xl text-parchment-50">{t('lorebookStudio.resources.empty.title')}</span>
                        <span className="max-w-[42ch] font-narrative text-sm">{t('lorebookStudio.resources.empty.description')}</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => addManualResource('txt')}>{t('lorebookStudio.resources.newText')}</Button>
                        <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>{t('lorebookStudio.resources.upload')}</Button>
                    </div>
                </div>
            ) : (
                <div className="divide-y divide-parchment-50/[.06]">
                    <div className="grid gap-2 px-4 py-3 sm:grid-cols-4">
                        <ResourceStat label={t('lorebookStudio.resources.stats.completed')} value={`${stats.completed}/${stats.total}`} />
                        <ResourceStat label={t('lorebookStudio.resources.stats.pending')} value={String(stats.pending)} />
                        <ResourceStat label={t('lorebookStudio.resources.stats.snippets')} value={String(stats.snippets)} />
                        <ResourceStat label={t('lorebookStudio.resources.stats.keywords')} value={String(stats.keywords)} />
                    </div>
                    {resources.map((resource) => {
                        const overLimit = resource.content.length > LOREBOOK_RESOURCE_MAX_CHARS
                        const triggerOverLimit = resource.triggers.length > LOREBOOK_RESOURCE_MAX_TRIGGERS
                        const invalid = overLimit || triggerOverLimit
                        const expanded = expandedIds.has(resource.id) || resource.extractionStatus !== 'completed' || resource.metadataOutdated || invalid
                        const extraction = lorebookResourceCompletedExtraction(resource)
                        const snippets = extraction?.snippets ?? []
                        return (
                            <section key={resource.id} className="grid gap-4 px-4 py-4" data-testid="lorebook-resource-card">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <IconButton
                                                label={expanded ? t('lorebookStudio.resources.collapse', { title: resource.title }) : t('lorebookStudio.resources.expand', { title: resource.title })}
                                                size="sm"
                                                onClick={() => toggleResource(resource.id)}
                                            >
                                                <Icon icon={expanded ? ChevronDown : ChevronRight} size={14} />
                                            </IconButton>
                                            <span className="truncate font-ui text-sm font-semibold text-parchment-50">{resource.title || resource.fileName}</span>
                                            <Tag>{resource.fileType.toUpperCase()}</Tag>
                                            <Badge tone={statusTone(resource)}>
                                                {t(`lorebookStudio.resources.status.${resource.extractionStatus ?? 'pending'}`)}
                                            </Badge>
                                            {resource.metadataOutdated && (
                                                <Badge tone="ember">
                                                    {t('lorebookStudio.resources.status.outdated')}
                                                </Badge>
                                            )}
                                            {snippets.length > 0 && (
                                                <Badge tone="arcane" icon={<Icon icon={Sparkles} size={11} />}>
                                                    {t('lorebookStudio.resources.snippetCount', { count: snippets.length })}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 font-ui text-xs text-parchment-400">
                                            {t('lorebookStudio.resources.fileMeta', {
                                                fileName: resource.fileName,
                                                count: resource.content.length,
                                                max: LOREBOOK_RESOURCE_MAX_CHARS,
                                            })}
                                        </p>
                                        {extraction?.shortSummary && (
                                            <p className="mt-1 line-clamp-2 font-narrative text-sm text-parchment-300">{extraction.shortSummary}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!expanded && (
                                            <Button variant="ghost" size="sm" onClick={() => expandResource(resource.id)} disabled={busy}>
                                                {t('lorebookStudio.resources.edit')}
                                            </Button>
                                        )}
                                        <IconButton
                                            label={t('lorebookStudio.resources.delete', { title: resource.title || resource.fileName })}
                                            size="sm"
                                            tone="danger"
                                            onClick={() => removeResource(resource.id)}
                                            disabled={busy}
                                        >
                                            <Icon icon={Trash2} size={14} />
                                        </IconButton>
                                    </div>
                                </div>

                                {!expanded ? (
                                    <ResourceExtractionPreview resource={resource} />
                                ) : (
                                    <>
                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <Field label={t('lorebookStudio.resources.fields.title.label')}>
                                                <Input
                                                    value={resource.title}
                                                    onChange={(event) => updateResource(resource.id, { title: event.target.value })}
                                                    placeholder={t('lorebookStudio.resources.fields.title.placeholder')}
                                                    disabled={busy}
                                                />
                                            </Field>
                                            <TriggersField
                                                values={resource.triggers}
                                                onChange={(triggers) => updateResource(resource.id, { triggers })}
                                                label={t('lorebookStudio.resources.fields.triggers.label')}
                                                helper={t('lorebookStudio.resources.fields.triggers.helper', { count: resource.triggers.length, max: LOREBOOK_RESOURCE_MAX_TRIGGERS })}
                                                placeholder={t('lorebookStudio.resources.fields.triggers.placeholder')}
                                                maxValues={LOREBOOK_RESOURCE_MAX_TRIGGERS}
                                                limitReachedText={t('lorebookStudio.resources.fields.triggers.limit', { max: LOREBOOK_RESOURCE_MAX_TRIGGERS })}
                                            />
                                        </div>

                                        <Field label={t('lorebookStudio.resources.fields.description.label')}>
                                            <Textarea
                                                value={resource.description ?? ''}
                                                onChange={(event) => updateResource(resource.id, { description: event.target.value })}
                                                placeholder={t('lorebookStudio.resources.fields.description.placeholder')}
                                                className="min-h-[86px]"
                                                disabled={busy}
                                            />
                                        </Field>

                                        <Field
                                            label={t('lorebookStudio.resources.fields.content.label')}
                                            error={overLimit ? t('lorebookStudio.resources.errors.size', { name: resource.fileName, count: LOREBOOK_RESOURCE_MAX_CHARS }) : undefined}
                                            helper={t('lorebookStudio.resources.fields.content.helper', { count: resource.content.length, max: LOREBOOK_RESOURCE_MAX_CHARS })}
                                        >
                                            <Textarea
                                                value={resource.content}
                                                onChange={(event) => updateResource(resource.id, { content: event.target.value, contentLength: event.target.value.length })}
                                                className={cx('min-h-[220px] font-mono text-xs', overLimit && 'border-blood-500/60')}
                                                disabled={busy}
                                                data-testid="lorebook-resource-content"
                                            />
                                        </Field>

                                        {triggerOverLimit && (
                                            <Callout tone="danger" role="alert">
                                                {t('lorebookStudio.resources.errors.triggers', { name: resource.fileName, count: LOREBOOK_RESOURCE_MAX_TRIGGERS })}
                                            </Callout>
                                        )}

                                        {resource.extractionStatus === 'completed' && resource.extraction && (
                                            <ResourceExtractionPreview resource={resource} expanded />
                                        )}
                                    </>
                                )}
                            </section>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function ResourceStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md bg-ink-800 px-3 py-2">
            <div className="font-ui text-meta font-semibold uppercase tracking-[0.14em] text-parchment-400">{label}</div>
            <div className="mt-0.5 font-display text-lg font-semibold text-parchment-50">{value}</div>
        </div>
    )
}

function ResourceExtractionPreview({ resource, expanded = false }: { resource: LorebookResource; expanded?: boolean }) {
    const { t } = useTranslation()
    const extraction = lorebookResourceCompletedExtraction(resource)
    const snippets = extraction?.snippets ?? []
    const keywords = extraction?.keywords ?? []
    if (!extraction) {
        return (
            <div className="rounded-lg border border-arcane-500/20 bg-arcane-500/[.06] px-3 py-3 font-ui text-xs text-parchment-300">
                {t('lorebookStudio.resources.extraction.pending')}
            </div>
        )
    }
    return (
        <div className="grid gap-3 rounded-lg border border-arcane-500/20 bg-arcane-500/[.06] px-3 py-3">
            {resource.metadataOutdated && (
                <div className="rounded-md border border-ember-500/30 bg-ember-500/10 px-3 py-2 font-ui text-xs text-parchment-200">
                    {t('lorebookStudio.resources.extraction.outdated')}
                </div>
            )}
            {keywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-ui text-xs font-semibold text-arcane-200">{t('lorebookStudio.resources.extraction.keywords')}</span>
                    {keywords.slice(0, expanded ? 24 : 10).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-ink-900/50 px-2 py-0.5 font-ui text-meta text-parchment-300">
                            {keyword}
                        </span>
                    ))}
                    {keywords.length > (expanded ? 24 : 10) && (
                        <span className="font-ui text-meta text-parchment-400">+{keywords.length - (expanded ? 24 : 10)}</span>
                    )}
                </div>
            )}
            {snippets.length > 0 && (
                <div className="grid gap-2">
                    <span className="font-ui text-xs font-semibold text-arcane-200">{t('lorebookStudio.resources.extraction.snippets')}</span>
                    <div className="grid gap-2">
                        {snippets.slice(0, expanded ? 8 : 3).map((snippet, index) => (
                            <div key={snippet.id ?? `${snippet.title}-${index}`} className="rounded-md border border-parchment-50/[.08] bg-ink-900/35 px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-ui text-xs font-semibold text-parchment-100">{snippet.title}</span>
                                    {snippet.source && <span className="font-mono text-micro text-parchment-500">{snippet.source}</span>}
                                </div>
                                <p className={cx('mt-1 font-narrative text-sm text-parchment-300', expanded ? 'line-clamp-4' : 'line-clamp-2')}>{snippet.content}</p>
                                {expanded && snippet.triggers.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {snippet.triggers.slice(0, 8).map((trigger) => <Tag key={trigger}>{trigger}</Tag>)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
