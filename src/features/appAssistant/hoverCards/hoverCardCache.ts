/**
 * Session caches behind the hover cards, so nothing loads before a hover and
 * nothing loads twice.
 *
 * - Previews: only records missing from the library are fetched, once per
 *   session and workspace (Workspace R1: a card is read in the committed
 *   workspace, never another). A 404/403 is remembered as "missing"; a network
 *   error is not, so the next hover tries again.
 * - Portraits: protected images arrive as authed blobs. The shared
 *   `useAuthenticatedMediaUrl` revokes its blob on unmount, which would
 *   re-download a portrait on every hover; here the object URL is kept (LRU,
 *   bounded) for the session.
 */
import { useEffect, useState } from 'react'
import { fetchCardPreview, type CardPreview } from '@/features/cards/cardPreview'
import { ApiError, apiService, isProtectedMediaUrl, resolveMediaUrl } from '@/infrastructure/api'
import { hoverCardKey, previewTargetFor, type HoverCardRef } from './hoverCardModel'
import { isContentTypeFeatureEnabled } from '@/shared/featureFlags'

const settledPreviews = new Map<string, CardPreview | null>()
const pendingPreviews = new Map<string, Promise<CardPreview | null>>()

function previewKey(ref: HoverCardRef, workspaceId: string): string {
    return `${workspaceId}:${hoverCardKey(ref)}`
}

/** The settled result for `ref` in a workspace (`null` = known missing), or undefined when never fetched. */
export function peekRemotePreview(ref: HoverCardRef, workspaceId: string | null): CardPreview | null | undefined {
    if (!workspaceId || !isContentTypeFeatureEnabled(ref.kind)) return null
    const key = previewKey(ref, workspaceId)
    return settledPreviews.has(key) ? settledPreviews.get(key) ?? null : undefined
}

/**
 * Fetch a preview once per workspace; concurrent hovers share the request.
 * Resolves null when the record is gone, or without a committed workspace.
 */
export function loadRemotePreview(ref: HoverCardRef, workspaceId: string | null): Promise<CardPreview | null> {
    if (!workspaceId || !isContentTypeFeatureEnabled(ref.kind)) return Promise.resolve(null)
    const key = previewKey(ref, workspaceId)
    if (settledPreviews.has(key)) return Promise.resolve(settledPreviews.get(key) ?? null)
    const pending = pendingPreviews.get(key)
    if (pending) return pending
    const target = previewTargetFor(ref)
    if (!target) {
        settledPreviews.set(key, null)
        return Promise.resolve(null)
    }
    const request = fetchCardPreview(target, apiService.withWorkspace(workspaceId))
        .then(
            (preview) => {
                settledPreviews.set(key, preview)
                return preview
            },
            (error: unknown) => {
                if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
                    settledPreviews.set(key, null)
                    return null
                }
                throw error
            },
        )
        .finally(() => pendingPreviews.delete(key))
    pendingPreviews.set(key, request)
    return request
}

// ---------------------------------------------------------------------------
// Portraits
// ---------------------------------------------------------------------------

const MEDIA_LIMIT = 40
/** Resolved URL → object URL, oldest first (re-inserted on use). */
const readyMedia = new Map<string, string>()
const pendingMedia = new Map<string, Promise<string>>()

/** A displayable URL right away: public media as-is, protected media once cached. */
export function peekHoverMedia(url: string | null | undefined): string | null {
    const resolved = resolveMediaUrl(url)
    if (!resolved) return null
    if (!isProtectedMediaUrl(resolved)) return resolved
    return readyMedia.get(resolved) ?? null
}

function loadHoverMedia(resolved: string): Promise<string> {
    const ready = readyMedia.get(resolved)
    if (ready) {
        readyMedia.delete(resolved)
        readyMedia.set(resolved, ready)
        return Promise.resolve(ready)
    }
    const pending = pendingMedia.get(resolved)
    if (pending) return pending
    const request = apiService.fetchProtectedMediaBlob(resolved, 'image/*')
        .then((blob) => {
            const objectUrl = URL.createObjectURL(blob)
            readyMedia.set(resolved, objectUrl)
            while (readyMedia.size > MEDIA_LIMIT) {
                const [oldest, oldestUrl] = readyMedia.entries().next().value as [string, string]
                readyMedia.delete(oldest)
                URL.revokeObjectURL(oldestUrl)
            }
            return objectUrl
        })
        .finally(() => pendingMedia.delete(resolved))
    pendingMedia.set(resolved, request)
    return request
}

/** A card portrait: loads (once per session) only when a hover card renders it. */
export function useHoverMedia(url: string | null | undefined): { src: string | null; loading: boolean } {
    const resolved = resolveMediaUrl(url) ?? null
    const immediate = peekHoverMedia(url)
    const [loaded, setLoaded] = useState<{ url: string | null; src: string | null; failed: boolean }>({ url: null, src: null, failed: false })

    useEffect(() => {
        if (!resolved || immediate) return
        let cancelled = false
        loadHoverMedia(resolved).then(
            (src) => {
                if (!cancelled) setLoaded({ url: resolved, src, failed: false })
            },
            () => {
                if (!cancelled) setLoaded({ url: resolved, src: null, failed: true })
            },
        )
        return () => {
            cancelled = true
        }
    }, [resolved, immediate])

    const settled = loaded.url === resolved ? loaded : null
    const src = immediate ?? settled?.src ?? null
    return { src, loading: Boolean(resolved) && !src && !settled?.failed }
}

/** Test seam: forget everything cached this session. */
export function resetHoverCardCaches(): void {
    settledPreviews.clear()
    pendingPreviews.clear()
    for (const objectUrl of readyMedia.values()) URL.revokeObjectURL(objectUrl)
    readyMedia.clear()
    pendingMedia.clear()
}
