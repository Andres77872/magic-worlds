import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { ApiError, apiService } from '@/infrastructure/api'
import { buildGalleryCardHash, galleryPageForType } from '../galleryLinks'
import type { GalleryItem, GalleryType } from '../galleryConfig'

export interface ImportActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

/** Where an import originates: a public/community card clone, or a shared-link import. */
export type ImportSource =
    | { kind: 'clone'; item: GalleryItem }
    | { kind: 'shared'; token: string; item: GalleryItem | null }

interface PendingConfirm {
    source: ImportSource
    title: string
    existingCardId?: string | null
    galleryType?: GalleryType
}

function sourceKey(source: ImportSource): string {
    if (source.kind === 'shared') return `shared:${source.token}`
    return `${source.item.backendType}:${source.item.id}`
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

/**
 * Single owner of the community/shared card IMPORT workflow, reused by the
 * community gallery, the public gallery view, and the shared-link page so all
 * three behave identically: auth-guard, warn+confirm on re-import (server 409 /
 * `already_imported`), force re-import, toasts, and a library refresh.
 */
export function useCardImport() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { loadData } = useData()
    const { setPage } = useNavigation()
    const [importingKey, setImportingKey] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ImportActionNotice | null>(null)
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)

    const runImport = useCallback(
        async (source: ImportSource, force: boolean) => {
            const key = sourceKey(source)
            const title = (source.item?.title ?? '').slice(0, 80)
            const galleryType = source.item?.galleryType
            setActionNotice(null)
            setImportingKey(key)
            try {
                if (source.kind === 'shared') {
                    await apiService.importSharedCard(source.token, { force })
                } else {
                    await apiService.cloneCard(source.item.backendType, source.item.id, { force })
                }
                await loadData({ silent: true })
                setPendingConfirm(null)
                setActionNotice({
                    tone: 'success',
                    title: t('gallery.action.importTitle'),
                    message: t('gallery.action.importBody', { title }),
                })
            } catch (error) {
                if (error instanceof ApiError && error.status === 409) {
                    // Race: server says it's already imported even though the badge wasn't shown.
                    const existingCardId =
                        (error.details?.existing_card_id as string | undefined) ?? source.item?.resource?.existing_card_id ?? null
                    setPendingConfirm({ source, title, existingCardId, galleryType })
                    return
                }
                console.error('Failed to import card:', error)
                setActionNotice({
                    tone: 'error',
                    title: t('gallery.action.importFailed'),
                    message: errorMessage(error, t('gallery.action.tryAgain')),
                })
            } finally {
                setImportingKey(null)
            }
        },
        [loadData, t],
    )

    const requestImport = useCallback(
        async (source: ImportSource) => {
            if (!isAuthenticated) {
                openLoginModal()
                return
            }
            if (importingKey) return
            const resource = source.item?.resource
            if (resource?.already_imported) {
                setPendingConfirm({
                    source,
                    title: source.item?.title ?? '',
                    existingCardId: resource.existing_card_id ?? null,
                    galleryType: source.item?.galleryType,
                })
                return
            }
            await runImport(source, false)
        },
        [importingKey, isAuthenticated, openLoginModal, runImport],
    )

    const confirmForceImport = useCallback(async () => {
        if (!pendingConfirm) return
        await runImport(pendingConfirm.source, true)
    }, [pendingConfirm, runImport])

    const cancelConfirm = useCallback(() => setPendingConfirm(null), [])

    const openExisting = useCallback(
        (cardId: string, galleryType: GalleryType) => {
            setPendingConfirm(null)
            setPage(galleryPageForType(galleryType), { hash: buildGalleryCardHash(galleryType, cardId) })
        },
        [setPage],
    )

    return {
        importingKey,
        actionNotice,
        setActionNotice,
        pendingConfirm,
        requestImport,
        confirmForceImport,
        cancelConfirm,
        openExisting,
    }
}

/** Tiny holder for the gallery preview modal target (an already-loaded item). */
export function useGalleryCardPreview() {
    const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null)
    const open = useCallback((item: GalleryItem) => setPreviewItem(item), [])
    const close = useCallback(() => setPreviewItem(null), [])
    return { previewItem, open, close }
}
