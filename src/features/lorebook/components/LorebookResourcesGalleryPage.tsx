import { useEffect, useRef, useState } from 'react'
import { FilePlus2, FileText, Link2, Loader2, Search, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { authSession } from '@/infrastructure/api/authSession'
import { TASK_REQUEST_FINISHED, type TaskRequestEvent } from '@/infrastructure/api/resourceTaskEvents'
import type { LorebookResource } from '@/shared'
import { organizationWorkspaceId, scopedApi } from '@/shared/hooks/useScopedApi'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY, isWorkspaceArchived, useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { buildResourceHash } from '@/features/gallery/galleryLinks'
import { ConfirmDialog } from '@/ui/components'
import { Button, Callout, Icon, IconButton, IconTile, PageHeader, controlClass } from '@/ui/primitives'
import {
    LOREBOOK_RESOURCE_ACCEPT,
    LOREBOOK_RESOURCE_MAX_CHARS,
    isAllowedResourceFile,
    lorebookResourceToApiPayload,
    normalizeLorebookResource,
    validateLorebookResources,
} from '../lorebookResources'
import { readLorebookResourceFile, resourceFileErrorKey } from '../lorebookResourceFiles'
import { useLorebookResourceGallery } from '../hooks/useLorebookResourceGallery'
import { useLorebookExtraction } from '../hooks/useLorebookExtraction'
import { applyLorebookExtraction } from '../lorebookExtractionSession'
import { resourceExtractionErrorKey } from '@/infrastructure/api/lorebookExtractionErrors'
import { ResourceGrid } from './resources/ResourceGrid'
import { ResourceDetailView } from './resources/ResourceDetailView'
import { useLorebookResourceRoute } from './resources/useLorebookResourceRoute'

export function LorebookResourcesGalleryPage() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { resourceEdit, setPage, goBack, replaceHash } = useNavigation()
    const { workspaces, workspaceEpoch, capture, isCurrent } = useWorkspace()
    // New resources land in the selected workspace: archived, it creates and imports nothing.
    const readOnly = useWorkspaceReadOnly()
    const gallery = useLorebookResourceGallery(undefined, { enabled: isAuthenticated })
    const extractResource = useLorebookExtraction()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<LorebookResource | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // A finished resource task (PDF import, metadata) of this account reloads the list,
    // unless it ran in another workspace (that one's list is not on screen).
    useEffect(() => {
        const completed = (event: Event) => {
            const detail = (event as CustomEvent<TaskRequestEvent>).detail
            const owner = authSession.getSnapshot()
            if (detail?.authEpoch !== owner.authEpoch || detail.accountKey !== owner.accountKey) return
            if (detail.workspaceId && detail.workspaceId !== capture()?.workspaceId) return
            gallery.refresh()
        }
        window.addEventListener(TASK_REQUEST_FINISHED, completed)
        return () => window.removeEventListener(TASK_REQUEST_FINISHED, completed)
    }, [capture, gallery.refresh])

    // Workspace switch: the previous workspace's dialogs and messages close with it.
    const [pageEpoch, setPageEpoch] = useState(workspaceEpoch)
    if (pageEpoch !== workspaceEpoch) {
        setPageEpoch(workspaceEpoch)
        setPendingDelete(null)
        setNotice(null)
        setError(null)
    }

    /**
     * A resource's own workspace (`organization`), else the one committed when
     * the action started; reads, writes and extraction of it stay there.
     */
    const resourceWorkspaceId = (resource: LorebookResource | null, scope: ReturnType<typeof capture>) => (
        organizationWorkspaceId(resource) ?? scope?.workspaceId ?? null
    )

    /**
     * Archived target workspace (document 08: read-only until restored): show why and
     * write nothing. Items are keyed on their own workspace, new work on the selected one.
     */
    const blockedByArchive = (workspaceId: string | null | undefined) => {
        const archived = isWorkspaceArchived(workspaces, workspaceId)
        if (archived) setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
        return archived
    }

    const route = useLorebookResourceRoute({
        items: gallery.items,
        upsertItem: gallery.upsertItem,
        onMissing: () => setNotice(t('lorebookResourcesGallery.errors.notFound')),
    })

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const createManual = (fileType: 'md' | 'txt') => {
        setError(null)
        if (blockedByArchive(capture()?.workspaceId)) return
        requireAuth(() => setPage('gallery-resources', { hash: buildResourceHash('new', fileType) }))
    }

    const openResource = (resource: LorebookResource) => {
        setError(null)
        setPage('gallery-resources', { hash: buildResourceHash(resource.id) })
    }

    const uploadFiles = async (files: FileList | null) => {
        if (!files?.length) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        const scope = capture()
        const workspaceId = scope?.workspaceId ?? null
        if (blockedByArchive(workspaceId)) return
        const api = scopedApi(workspaceId)
        if (!api) return
        setSaving(true)
        setError(null)
        setNotice(null)
        const owner = authSession.getSnapshot()
        // Uploads land in the workspace committed when they started, even after a switch.
        const current = () => authSession.isCurrent(owner) && isCurrent(scope)
        let uploadedCount = 0
        try {
            for (const file of Array.from(files)) {
                if (!isAllowedResourceFile(file)) {
                    setError(t('lorebookResourcesGallery.errors.uploadFileType', { name: file.name }))
                    continue
                }
                let sourceSaved = false
                const isPdf = file.name.toLowerCase().endsWith('.pdf')
                try {
                    const resource = await readLorebookResourceFile(file, api)
                    if (!current()) return
                    if (resource.content.length > LOREBOOK_RESOURCE_MAX_CHARS) {
                        setError(t('lorebookResourcesGallery.errors.size', { name: file.name, count: LOREBOOK_RESOURCE_MAX_CHARS }))
                        continue
                    }
                    // A PDF import is saved by the server (in the captured workspace) already.
                    const created = isPdf
                        ? resource
                        : normalizeLorebookResource(await api.createLorebookResource(lorebookResourceToApiPayload(resource)))
                    if (!current()) return
                    if (!created) throw new Error(t('lorebookResourcesGallery.errors.saveFailed'))
                    gallery.upsertItem(created)
                    sourceSaved = true
                    if (isPdf) {
                        // Metadata is generated in the resource's own workspace, never the committed one.
                        const result = await extractResource(created, undefined, null, organizationWorkspaceId(created) ?? workspaceId)
                        if (!current()) return
                        gallery.upsertItem(applyLorebookExtraction(created, result))
                    }
                    uploadedCount += 1
                } catch (err) {
                    if (!current()) return
                    const key = resourceFileErrorKey(err)
                    setError(sourceSaved ? t(resourceExtractionErrorKey(err)) : key ? t(key, { name: file.name }) : err instanceof Error ? err.message : t('lorebookResourcesGallery.errors.saveFailed'))
                }
            }
            if (uploadedCount > 0) setNotice(t('lorebookResourcesGallery.notices.uploaded'))
        } finally {
            setSaving(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const saveResource = async (resource: LorebookResource, options: { extractMetadata?: boolean } = {}): Promise<boolean> => {
        if (!isAuthenticated) {
            openLoginModal()
            return false
        }
        const validation = validateLorebookResources([resource])
        if (validation) {
            setError(validation)
            return false
        }
        const creating = resourceEdit?.resourceId === 'new'
        const scope = capture()
        const workspaceId = resourceWorkspaceId(creating ? null : resource, scope)
        if (blockedByArchive(workspaceId)) return false
        const api = scopedApi(workspaceId)
        if (!api) return false
        const owner = authSession.getSnapshot()
        const current = () => authSession.isCurrent(owner) && isCurrent(scope)
        let sourceSaved = false
        setSaving(true)
        setError(null)
        try {
            const payload = lorebookResourceToApiPayload(resource)
            const raw = creating
                ? await api.createLorebookResource(payload)
                : await api.updateLorebookResource(resource.id, payload)
            const saved = normalizeLorebookResource(raw)
            if (!saved) throw new Error(t('lorebookResourcesGallery.errors.saveFailed'))
            if (!current()) return false
            gallery.upsertItem(saved)
            if (creating) replaceHash(buildResourceHash(saved.id))
            sourceSaved = true
            if (options.extractMetadata && (saved.extractionStatus !== 'completed' || saved.metadataOutdated)) {
                const result = await extractResource(saved, undefined, null, organizationWorkspaceId(saved) ?? workspaceId)
                if (!current()) return false
                gallery.upsertItem(applyLorebookExtraction(saved, result))
            }
            setNotice(creating ? t('lorebookResourcesGallery.notices.created') : t('lorebookResourcesGallery.notices.updated'))
            return true
        } catch (err) {
            if (!current()) return false
            setError(sourceSaved ? t(resourceExtractionErrorKey(err)) : err instanceof Error ? err.message : t('lorebookResourcesGallery.errors.saveFailed'))
            // A successful source save must leave creation mode even if extraction failed.
            return sourceSaved
        } finally {
            setSaving(false)
        }
    }

    const syncResourceMetadata = async (resource: LorebookResource): Promise<boolean> => {
        if (!isAuthenticated) {
            openLoginModal()
            return false
        }
        const scope = capture()
        const workspaceId = resourceWorkspaceId(resource, scope)
        if (!workspaceId || blockedByArchive(workspaceId)) return false
        setSaving(true)
        setError(null)
        const owner = authSession.getSnapshot()
        const current = () => authSession.isCurrent(owner) && isCurrent(scope)
        try {
            // A retained request is read back in its own workspace, never the committed one.
            const result = await extractResource(resource, undefined, null, workspaceId)
            if (!current()) return false
            gallery.upsertItem(applyLorebookExtraction(resource, result))
            setNotice(t('lorebookResourcesGallery.notices.metadataSynced'))
            return true
        } catch (err) {
            if (!current()) return false
            setError(t(resourceExtractionErrorKey(err)))
            return false
        } finally {
            setSaving(false)
        }
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        const viewingTarget = resourceEdit?.resourceId === target.id
        const scope = capture()
        const workspaceId = resourceWorkspaceId(target, scope)
        if (blockedByArchive(workspaceId)) return
        const api = scopedApi(workspaceId)
        if (!api) return
        setDeletingId(target.id)
        setError(null)
        try {
            await api.deleteLorebookResource(target.id)
            if (!isCurrent(scope)) return
            if (viewingTarget) goBack('gallery-resources')
            gallery.removeItem(target.id)
            setNotice(t('lorebookResourcesGallery.notices.deleted'))
        } catch (err) {
            if (!isCurrent(scope)) return
            setError(err instanceof Error ? err.message : t('lorebookResourcesGallery.errors.deleteFailed'))
        } finally {
            setDeletingId(null)
        }
    }

    const requestDelete = (resource: LorebookResource) => {
        if (!blockedByArchive(resourceWorkspaceId(resource, capture()))) setPendingDelete(resource)
    }

    const hasQuery = gallery.query.trim().length > 0

    const banner = (error || gallery.error || notice) ? (
        <div className="grid gap-3">
            {(error || gallery.error) && (
                <Callout
                    tone="danger"
                    role="alert"
                    action={gallery.error ? <Button variant="secondary" size="sm" onClick={gallery.refresh}>{t('lorebookResourcesGallery.actions.retry')}</Button> : undefined}
                >
                    {error || gallery.error}
                </Callout>
            )}
            {notice && <Callout tone="success">{notice}</Callout>}
        </div>
    ) : null

    return (
        <>
            {resourceEdit ? (
                route.resource ? (
                    <ResourceDetailView
                        resource={route.resource}
                        isCreate={route.isCreate}
                        loading={route.loading}
                        saving={saving}
                        banner={banner}
                        onSave={saveResource}
                        onSyncMetadata={syncResourceMetadata}
                        onDelete={requestDelete}
                        onBack={() => goBack('gallery-resources')}
                    />
                ) : (
                    <div className="mx-auto flex min-h-[60vh] w-full max-w-[1160px] items-center justify-center px-5 py-8 sm:px-8 sm:py-10">
                        <Loader2 className="animate-spin text-ember-500" size={26} aria-hidden="true" />
                    </div>
                )
            ) : (
                <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
                    <PageHeader
                        eyebrow={t('lorebookResourcesGallery.header.eyebrow')}
                        title={t('lorebookResourcesGallery.header.title')}
                        icon={<IconTile icon={FileText} tone="arcane" size="md" />}
                        size="lg"
                        subtitle={t('lorebookResourcesGallery.header.subtitle')}
                        actions={
                            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
                                <div className="relative flex w-full items-center sm:w-[320px]">
                                    <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                                        <Icon icon={Search} size={16} />
                                    </span>
                                    <input
                                        type="search"
                                        value={gallery.query}
                                        onChange={(event) => gallery.setQuery(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Escape') gallery.setQuery('')
                                        }}
                                        placeholder={t('lorebookResourcesGallery.search.placeholder')}
                                        aria-label={t('lorebookResourcesGallery.search.label')}
                                        className={`${controlClass} rounded-full pl-10 ${gallery.searching && hasQuery ? 'pr-16' : 'pr-12'}`}
                                    />
                                    {gallery.searching && (
                                        <Loader2 className={`absolute ${hasQuery ? 'right-12' : 'right-4'} animate-spin text-ember-500`} size={16} aria-hidden="true" />
                                    )}
                                    {hasQuery && (
                                        <IconButton size="sm" onClick={() => gallery.setQuery('')} label={t('lorebookResourcesGallery.actions.clearSearch')} className="absolute right-2">
                                            <Icon icon={X} size={16} />
                                        </IconButton>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={LOREBOOK_RESOURCE_ACCEPT}
                                    multiple
                                    className="sr-only"
                                    disabled={saving || readOnly}
                                    aria-label={t('lorebookResourcesGallery.actions.upload')}
                                    onChange={(event) => void uploadFiles(event.target.files)}
                                />
                                <Button variant="secondary" iconLeft={<Icon icon={FilePlus2} size={16} />} onClick={() => createManual('txt')} disabled={saving || readOnly}>
                                    {t('lorebookResourcesGallery.actions.newText')}
                                </Button>
                                <Button variant="secondary" iconLeft={<Icon icon={FilePlus2} size={16} />} onClick={() => createManual('md')} disabled={saving || readOnly}>
                                    {t('lorebookResourcesGallery.actions.newMarkdown')}
                                </Button>
                                <Button variant="secondary" iconLeft={<Icon icon={Link2} size={16} />} onClick={() => createManual('md')} disabled={saving || readOnly}>
                                    {t('lorebookResourcesGallery.actions.fromUrl')}
                                </Button>
                                <Button variant="primary" iconLeft={<Icon icon={Upload} size={16} />} onClick={() => requireAuth(() => fileInputRef.current?.click())} disabled={saving || readOnly}>
                                    {saving ? t('common.saving') : t('lorebookResourcesGallery.actions.upload')}
                                </Button>
                            </div>
                        }
                    />

                    {banner}

                    {(!gallery.error || gallery.items.length > 0) && <ResourceGrid
                        items={gallery.items}
                        loading={gallery.loading}
                        hasMore={gallery.hasMore}
                        loadingMore={gallery.loadingMore}
                        deletingId={deletingId}
                        hasQuery={hasQuery}
                        onLoadMore={gallery.loadMore}
                        onClearSearch={() => gallery.setQuery('')}
                        onCreate={() => createManual('txt')}
                        createDisabled={readOnly}
                        onOpen={openResource}
                        onDelete={requestDelete}
                    />}
                </div>
            )}

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('lorebookResourcesGallery.deleteDialog.title')}
                message={pendingDelete ? t('lorebookResourcesGallery.deleteDialog.message', { name: (pendingDelete.title || pendingDelete.fileName).slice(0, 80) }) : ''}
                confirmLabel={t('lorebookResourcesGallery.actions.delete')}
                cancelLabel={t('lorebookResourcesGallery.actions.keep')}
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </>
    )
}
