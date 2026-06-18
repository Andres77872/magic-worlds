import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ExternalLink, Link2, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LorebookResource } from '@/shared'
import { Badge, Button, Field, Icon, IconButton, Input, SwitchRow, Tag, Textarea } from '@/ui/primitives'
import { TriggersField } from '@/features/creation/common/components'
import { formatApiDateTime } from '@/utils/time'
import {
    LOREBOOK_RESOURCE_MAX_CHARS,
    LOREBOOK_RESOURCE_MAX_TRIGGERS,
    invalidateLorebookResourceExtraction,
    lorebookResourceCompletedExtraction,
    lorebookResourceFileTypeFromName,
} from '../../lorebookResources'
import {
    MarkdownNewImportError,
    deriveMarkdownResourceIdentity,
    importMarkdownFromUrl,
} from '../../markdownNewImport'
import { ResourceContentView, type ContentView } from './ResourceContentView'
import { ResourceExtractionMetadata } from './ResourceExtractionMetadata'
import { statusTone } from './resourceStatus'

interface ResourceDetailViewProps {
    /** The canonical resource (a fresh draft when creating). */
    resource: LorebookResource
    /** True while creating a brand-new resource (`?resource=new`). */
    isCreate: boolean
    /** Cold deep-link hydration in flight. */
    loading: boolean
    saving: boolean
    /** Persist the resource; resolves true on success so the view can drop to read mode. */
    onSave: (resource: LorebookResource, options?: { extractMetadata?: boolean }) => Promise<boolean>
    onSyncMetadata?: (resource: LorebookResource) => Promise<boolean>
    onDelete: (resource: LorebookResource) => void
    onBack: () => void
    /** Page-level notice / error banners, rendered under the header. */
    banner?: ReactNode
}

const defaultContentView = (resource: LorebookResource): ContentView =>
    resource.fileType === 'md' ? 'markdown' : 'plain'

/**
 * The dedicated, deep-linkable view for a single resource — replaces the old
 * slide-in editor drawer. Reads as a full page (title, status, metadata, rendered
 * content) and flips into an inline editor for the same fields.
 */
export function ResourceDetailView({ resource, isCreate, loading, saving, onSave, onSyncMetadata, onDelete, onBack, banner }: ResourceDetailViewProps) {
    const { t } = useTranslation()
    const [mode, setMode] = useState<'read' | 'edit'>(isCreate ? 'edit' : 'read')
    const [draft, setDraft] = useState<LorebookResource>(resource)
    const [contentView, setContentView] = useState<ContentView>(() => defaultContentView(resource))
    const [extractMetadata, setExtractMetadata] = useState(false)
    const [urlImportValue, setUrlImportValue] = useState('')
    const [urlImporting, setUrlImporting] = useState(false)
    const [urlImportError, setUrlImportError] = useState<string | null>(null)
    const [urlImportNotice, setUrlImportNotice] = useState<string | null>(null)
    const [urlImportFallbackUrl, setUrlImportFallbackUrl] = useState<string | null>(null)

    // A different resource opened (id change / cold hydration / create→saved): re-seed the view.
    useEffect(() => {
        setDraft(resource)
        setMode(isCreate ? 'edit' : 'read')
        setContentView(defaultContentView(resource))
        setExtractMetadata(false)
        setUrlImportValue('')
        setUrlImportError(null)
        setUrlImportNotice(null)
        setUrlImportFallbackUrl(null)
        // Keyed on the resolved id; `isCreate` flips false once a create is saved.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resource.id])

    const patch = (changes: Partial<LorebookResource>) => {
        setDraft((current) => invalidateLorebookResourceExtraction(current, changes))
    }

    const overLimit = draft.content.length > LOREBOOK_RESOURCE_MAX_CHARS
    const triggerOverLimit = draft.triggers.length > LOREBOOK_RESOURCE_MAX_TRIGGERS
    const isEdit = mode === 'edit'

    const startEdit = () => {
        setDraft(resource)
        setExtractMetadata(false)
        setMode('edit')
    }
    const cancelEdit = () => {
        if (isCreate) {
            onBack()
            return
        }
        setDraft(resource)
        setExtractMetadata(false)
        setMode('read')
    }
    const save = async () => {
        const ok = await onSave(draft, { extractMetadata })
        // Drop to read on success. For a create, the parent stamps the saved id into the
        // URL; if that changes the resolved id the reset effect re-seeds, otherwise this
        // covers the case where the API echoes the client-side id.
        if (ok) {
            setExtractMetadata(false)
            setMode('read')
        }
    }
    const syncMetadata = async () => {
        if (!onSyncMetadata) return
        await onSyncMetadata(resource)
    }
    const importUrl = async () => {
        setUrlImportError(null)
        setUrlImportNotice(null)
        setUrlImportFallbackUrl(null)
        setUrlImporting(true)
        try {
            const result = await importMarkdownFromUrl(urlImportValue)
            setDraft((current) => {
                const changes: Partial<LorebookResource> = {
                    content: result.markdown,
                    contentLength: result.markdown.length,
                }
                if (isCreate && current.content.trim().length === 0) {
                    const identity = deriveMarkdownResourceIdentity(result.markdown, result.sourceUrl)
                    changes.title = identity.title
                    changes.fileName = identity.fileName
                    changes.fileType = 'md'
                }
                return invalidateLorebookResourceExtraction(current, changes)
            })
            setContentView('plain')
            setUrlImportValue(result.sourceUrl)
            setUrlImportNotice(t('lorebookResourcesGallery.urlImport.success'))
        } catch (err) {
            if (err instanceof MarkdownNewImportError) {
                if (err.code === 'cors' && err.conversionUrl) {
                    setUrlImportFallbackUrl(err.conversionUrl)
                }
                setUrlImportError(urlImportErrorMessage(err))
            } else {
                setUrlImportError(t('lorebookResourcesGallery.urlImport.errors.failed'))
            }
        } finally {
            setUrlImporting(false)
        }
    }
    const openMarkdownNewFallback = () => {
        if (!urlImportFallbackUrl) return
        window.open(urlImportFallbackUrl, '_blank', 'noopener,noreferrer')
    }
    const urlImportErrorMessage = (error: MarkdownNewImportError): string => {
        if (error.code === 'invalid-url') return t('lorebookResourcesGallery.urlImport.errors.invalidUrl')
        if (error.code === 'unsupported-url') return t('lorebookResourcesGallery.urlImport.errors.unsupportedUrl')
        if (error.code === 'rate-limited') return t('lorebookResourcesGallery.urlImport.errors.rateLimited')
        if (error.code === 'cors') return t('lorebookResourcesGallery.urlImport.errors.cors')
        if (error.code === 'empty-response') return t('lorebookResourcesGallery.urlImport.errors.empty')
        return t('lorebookResourcesGallery.urlImport.errors.failed')
    }

    const headTitle = (isEdit ? draft.title || draft.fileName : resource.title || resource.fileName)
    const headType = (isEdit ? draft.fileType : resource.fileType).toUpperCase()
    const createdAt = formatApiDateTime(resource.createdAt)
    const updatedAt = formatApiDateTime(resource.updatedAt)
    const contentLength = resource.contentLength ?? resource.content.length
    const extraction = lorebookResourceCompletedExtraction(resource)
    const snippets = extraction?.snippets ?? []

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-4">
                <Button variant="ghost" size="sm" iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack} className="self-start">
                    {t('lorebookResourcesGallery.actions.back')}
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="truncate font-display text-3xl font-semibold leading-tight text-parchment-50" title={headTitle}>
                            {headTitle}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Tag>{headType}</Tag>
                            {!isCreate && <Badge tone={statusTone(resource)}>{resource.extractionStatus ?? 'pending'}</Badge>}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {isEdit ? (
                            <>
                                <Button variant="ghost" type="button" onClick={cancelEdit} disabled={saving}>
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    variant="primary"
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving || overLimit || triggerOverLimit}
                                    iconLeft={saving ? <Icon icon={Loader2} className="animate-spin" size={16} /> : undefined}
                                >
                                    {saving ? t('common.saving') : isCreate ? t('lorebookResourcesGallery.actions.create') : t('common.save')}
                                </Button>
                            </>
                        ) : (
                            <>
                                {onSyncMetadata && (
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        iconLeft={<Icon icon={saving ? Loader2 : RefreshCw} className={saving ? 'animate-spin' : undefined} size={16} />}
                                        onClick={() => void syncMetadata()}
                                        disabled={saving}
                                    >
                                        {t('lorebookResourcesGallery.actions.syncMetadata')}
                                    </Button>
                                )}
                                <Button variant="primary" type="button" iconLeft={<Icon icon={Pencil} size={16} />} onClick={startEdit}>
                                    {t('lorebookResourcesGallery.actions.edit')}
                                </Button>
                                <IconButton label={t('lorebookResourcesGallery.card.deleteAria', { name: headTitle })} tone="danger" onClick={() => onDelete(resource)}>
                                    <Icon icon={Trash2} size={16} />
                                </IconButton>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {banner}

            {loading ? (
                <div className="flex min-h-[320px] items-center justify-center">
                    <Loader2 className="animate-spin text-ember-500" size={26} aria-hidden="true" />
                </div>
            ) : isEdit ? (
                <div className="grid gap-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Field label={t('lorebookResourcesGallery.editor.titleLabel')}>
                            <Input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
                        </Field>
                        <Field label={t('lorebookResourcesGallery.editor.fileNameLabel')}>
                            <Input
                                value={draft.fileName}
                                onChange={(event) => {
                                    const fileName = event.target.value
                                    const fileType = lorebookResourceFileTypeFromName(fileName)
                                    patch({ fileName, fileType })
                                    setContentView(defaultContentView({ ...draft, fileName, fileType }))
                                }}
                            />
                        </Field>
                    </div>
                    <TriggersField
                        values={draft.triggers}
                        onChange={(triggers) => patch({ triggers })}
                        label={t('lorebookResourcesGallery.editor.triggersLabel')}
                        helper={t('lorebookResourcesGallery.editor.triggersHelper', { count: draft.triggers.length, max: LOREBOOK_RESOURCE_MAX_TRIGGERS })}
                        placeholder={t('lorebookResourcesGallery.editor.triggersPlaceholder')}
                        maxValues={LOREBOOK_RESOURCE_MAX_TRIGGERS}
                        limitReachedText={t('lorebookResourcesGallery.editor.triggersLimit', { max: LOREBOOK_RESOURCE_MAX_TRIGGERS })}
                    />
                    <Field label={t('lorebookResourcesGallery.editor.descriptionLabel')}>
                        <Textarea value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value })} className="min-h-[86px]" />
                    </Field>
                    <section className="grid gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700/70 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                            <Field
                                className="min-w-0 flex-1"
                                label={t('lorebookResourcesGallery.urlImport.label')}
                                helper={t('lorebookResourcesGallery.urlImport.helper')}
                                error={urlImportError}
                            >
                                <Input
                                    type="url"
                                    value={urlImportValue}
                                    placeholder={t('lorebookResourcesGallery.urlImport.placeholder')}
                                    disabled={saving || urlImporting}
                                    onChange={(event) => {
                                        setUrlImportValue(event.target.value)
                                        setUrlImportError(null)
                                        setUrlImportNotice(null)
                                        setUrlImportFallbackUrl(null)
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            if (!urlImporting && urlImportValue.trim()) void importUrl()
                                        }
                                    }}
                                />
                            </Field>
                            <Button
                                variant="arcane"
                                type="button"
                                iconLeft={<Icon icon={urlImporting ? Loader2 : Link2} className={urlImporting ? 'animate-spin' : undefined} size={16} />}
                                onClick={() => void importUrl()}
                                disabled={saving || urlImporting || !urlImportValue.trim()}
                            >
                                {urlImporting ? t('lorebookResourcesGallery.urlImport.importing') : t('lorebookResourcesGallery.urlImport.import')}
                            </Button>
                            {urlImportFallbackUrl && (
                                <Button
                                    variant="secondary"
                                    type="button"
                                    iconLeft={<Icon icon={ExternalLink} size={16} />}
                                    onClick={openMarkdownNewFallback}
                                    disabled={saving || urlImporting}
                                >
                                    {t('lorebookResourcesGallery.urlImport.openMarkdownNew')}
                                </Button>
                            )}
                        </div>
                        {urlImportNotice && (
                            <p className="m-0 font-ui text-caption text-verdant-500" role="status">
                                {urlImportNotice}
                            </p>
                        )}
                    </section>
                    <ResourceContentView
                        mode="edit"
                        content={draft.content}
                        view={contentView}
                        onViewChange={setContentView}
                        onChange={(value) => patch({ content: value, contentLength: value.length })}
                        overLimit={overLimit}
                        helper={t('lorebookResourcesGallery.editor.contentHelper', { count: draft.content.length, max: LOREBOOK_RESOURCE_MAX_CHARS })}
                        error={overLimit ? t('lorebookResourcesGallery.errors.size', { name: draft.fileName, count: LOREBOOK_RESOURCE_MAX_CHARS }) : undefined}
                    />
                    <SwitchRow
                        label={t('lorebookResourcesGallery.metadata.syncOnSaveLabel')}
                        description={t('lorebookResourcesGallery.metadata.syncOnSaveDescription')}
                        checked={extractMetadata}
                        onChange={setExtractMetadata}
                        disabled={saving}
                    />
                    {extractMetadata && (
                        <div className="rounded-lg border border-ember-500/30 bg-ember-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="note">
                            {t('lorebookResourcesGallery.metadata.saveUsageWarning')}
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid gap-5">
                    {resource.description && (
                        <p className="m-0 max-w-[72ch] font-narrative text-base leading-relaxed text-parchment-200">{resource.description}</p>
                    )}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {createdAt && <Tag>{t('lorebookResourcesGallery.detail.created', { date: createdAt })}</Tag>}
                            {updatedAt && updatedAt !== createdAt && <Tag>{t('lorebookResourcesGallery.detail.updated', { date: updatedAt })}</Tag>}
                            <Tag>{t('lorebookResourcesGallery.detail.chars', { count: contentLength })}</Tag>
                            <Tag>{t('lorebookResourcesGallery.card.snippetCount', { count: snippets.length })}</Tag>
                            {(resource.linkCount ?? 0) > 0 && <Tag>{t('lorebookResourcesGallery.detail.links', { count: resource.linkCount })}</Tag>}
                        </div>
                        {resource.triggers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {resource.triggers.slice(0, 12).map((trigger) => (
                                    <Tag key={trigger}>{trigger}</Tag>
                                ))}
                                {resource.triggers.length > 12 && <Tag>+{resource.triggers.length - 12}</Tag>}
                            </div>
                        )}
                    </div>
                    <ResourceExtractionMetadata resource={resource} />
                    {onSyncMetadata && (
                        <div className="rounded-lg border border-ember-500/30 bg-ember-500/10 px-4 py-3 font-ui text-sm text-parchment-200" role="note">
                            {t('lorebookResourcesGallery.metadata.syncUsageWarning')}
                        </div>
                    )}
                    <ResourceContentView
                        mode="read"
                        content={resource.content}
                        view={contentView}
                        onViewChange={setContentView}
                    />
                </div>
            )}
        </div>
    )
}
