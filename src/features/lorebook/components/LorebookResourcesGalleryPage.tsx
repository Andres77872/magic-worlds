import { useEffect, useRef, useState } from 'react'
import { FilePlus2, FileText, Link2, Loader2, Search, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth, useNavigation } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import { authSession } from '@/infrastructure/api/authSession'
import { TASK_REQUEST_FINISHED, type TaskRequestEvent } from '@/infrastructure/api/resourceTaskEvents'
import type { LorebookResource } from '@/shared'
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
    const gallery = useLorebookResourceGallery(undefined, { enabled: isAuthenticated })
    const extractResource = useLorebookExtraction()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<LorebookResource | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        const completed = (event: Event) => {
            const detail = (event as CustomEvent<TaskRequestEvent>).detail
            const owner = authSession.getSnapshot()
            if (detail?.authEpoch === owner.authEpoch && detail.accountKey === owner.accountKey) gallery.refresh()
        }
        window.addEventListener(TASK_REQUEST_FINISHED, completed)
        return () => window.removeEventListener(TASK_REQUEST_FINISHED, completed)
    }, [gallery.refresh])

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
        setSaving(true)
        setError(null)
        setNotice(null)
        const owner = authSession.getSnapshot()
        let uploadedCount = 0
        try {
            for (const file of Array.from(files)) {
                if (!isAllowedResourceFile(file)) {
                    setError(t('lorebookResourcesGallery.errors.uploadFileType', { name: file.name }))
                    continue
                }
                let sourceSaved = false
                try {
                    const resource = await readLorebookResourceFile(file)
                    if (!authSession.isCurrent(owner)) return
                    if (resource.content.length > LOREBOOK_RESOURCE_MAX_CHARS) {
                        setError(t('lorebookResourcesGallery.errors.size', { name: file.name, count: LOREBOOK_RESOURCE_MAX_CHARS }))
                        continue
                    }
                    const created = file.name.toLowerCase().endsWith('.pdf')
                        ? resource
                        : normalizeLorebookResource(await apiService.createLorebookResource(lorebookResourceToApiPayload(resource)))
                    if (!authSession.isCurrent(owner)) return
                    if (!created) throw new Error(t('lorebookResourcesGallery.errors.saveFailed'))
                    gallery.upsertItem(created)
                    sourceSaved = true
                    if (file.name.toLowerCase().endsWith('.pdf')) {
                        const result = await extractResource(created)
                        if (!authSession.isCurrent(owner)) return
                        gallery.upsertItem(applyLorebookExtraction(created, result))
                    }
                    uploadedCount += 1
                } catch (err) {
                    if (!authSession.isCurrent(owner)) return
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
        const owner = authSession.getSnapshot()
        let sourceSaved = false
        setSaving(true)
        setError(null)
        try {
            const payload = lorebookResourceToApiPayload(resource)
            const raw = creating
                ? await apiService.createLorebookResource(payload)
                : await apiService.updateLorebookResource(resource.id, payload)
            const saved = normalizeLorebookResource(raw)
            if (!saved) throw new Error(t('lorebookResourcesGallery.errors.saveFailed'))
            if (!authSession.isCurrent(owner)) return false
            gallery.upsertItem(saved)
            if (creating) replaceHash(buildResourceHash(saved.id))
            sourceSaved = true
            if (options.extractMetadata && (saved.extractionStatus !== 'completed' || saved.metadataOutdated)) {
                const result = await extractResource(saved)
                if (!authSession.isCurrent(owner)) return false
                gallery.upsertItem(applyLorebookExtraction(saved, result))
            }
            setNotice(creating ? t('lorebookResourcesGallery.notices.created') : t('lorebookResourcesGallery.notices.updated'))
            return true
        } catch (err) {
            if (!authSession.isCurrent(owner)) return false
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
        setSaving(true)
        setError(null)
        const owner = authSession.getSnapshot()
        try {
            const result = await extractResource(resource)
            if (!authSession.isCurrent(owner)) return false
            gallery.upsertItem(applyLorebookExtraction(resource, result))
            setNotice(t('lorebookResourcesGallery.notices.metadataSynced'))
            return true
        } catch (err) {
            if (!authSession.isCurrent(owner)) return false
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
        setDeletingId(target.id)
        setError(null)
        try {
            await apiService.deleteLorebookResource(target.id)
            if (viewingTarget) goBack('gallery-resources')
            gallery.removeItem(target.id)
            setNotice(t('lorebookResourcesGallery.notices.deleted'))
        } catch (err) {
            setError(err instanceof Error ? err.message : t('lorebookResourcesGallery.errors.deleteFailed'))
        } finally {
            setDeletingId(null)
        }
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
                        onDelete={(resource) => setPendingDelete(resource)}
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
                                    disabled={saving}
                                    aria-label={t('lorebookResourcesGallery.actions.upload')}
                                    onChange={(event) => void uploadFiles(event.target.files)}
                                />
                                <Button variant="secondary" iconLeft={<Icon icon={FilePlus2} size={16} />} onClick={() => createManual('txt')} disabled={saving}>
                                    {t('lorebookResourcesGallery.actions.newText')}
                                </Button>
                                <Button variant="secondary" iconLeft={<Icon icon={FilePlus2} size={16} />} onClick={() => createManual('md')} disabled={saving}>
                                    {t('lorebookResourcesGallery.actions.newMarkdown')}
                                </Button>
                                <Button variant="secondary" iconLeft={<Icon icon={Link2} size={16} />} onClick={() => createManual('md')} disabled={saving}>
                                    {t('lorebookResourcesGallery.actions.fromUrl')}
                                </Button>
                                <Button variant="primary" iconLeft={<Icon icon={Upload} size={16} />} onClick={() => requireAuth(() => fileInputRef.current?.click())} disabled={saving}>
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
                        onOpen={openResource}
                        onDelete={(resource) => setPendingDelete(resource)}
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
