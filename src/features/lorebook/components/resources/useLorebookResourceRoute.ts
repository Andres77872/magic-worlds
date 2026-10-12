/**
 * useLorebookResourceRoute — resolves the resource targeted by the current hash
 * (`#/gallery/resources?resource=<id>` or `?resource=new&type=`).
 *
 * - `new` yields a stable fresh draft (regenerated only when a new create begins).
 * - An id already in the loaded gallery list is used directly, so post-save
 *   upserts flow straight through to the view.
 * - A cold deep-link / refresh whose id isn't loaded is fetched once via
 *   `getLorebookResource` and folded back into the gallery; a missing or
 *   not-owned id bounces back to the grid (mirrors `useCardEditorRoute`).
 * - Workspace R1: the fetch uses the committed workspace's client; a committed
 *   switch drops the fetched resource and the unsaved create draft, and a late
 *   result of the previous workspace is ignored.
 */
import { useEffect, useRef, useState } from 'react'
import { useAuth, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { LorebookResource } from '@/shared'
import { newLorebookResource, nextLorebookResourceFileName, normalizeLorebookResource } from '../../lorebookResources'

interface UseLorebookResourceRouteOptions {
    items: LorebookResource[]
    upsertItem: (resource: LorebookResource) => void
    /** Called when a deep-linked resource can't be loaded, before bouncing to the grid. */
    onMissing?: () => void
}

interface UseLorebookResourceRouteResult {
    /** The resource to render, or null while resolving / when there is no target. */
    resource: LorebookResource | null
    isCreate: boolean
    /** A cold fetch is in flight. */
    loading: boolean
}

export function useLorebookResourceRoute({ items, upsertItem, onMissing }: UseLorebookResourceRouteOptions): UseLorebookResourceRouteResult {
    const { resourceEdit, setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { api, workspaceEpoch, capture, isCurrent } = useWorkspace()

    const resourceId = resourceEdit?.resourceId ?? null
    const isCreate = resourceId === 'new'
    const fromItems = resourceId && !isCreate ? items.find((item) => item.id === resourceId) ?? null : null

    const [createDraft, setCreateDraft] = useState<LorebookResource | null>(null)
    const [fetched, setFetched] = useState<LorebookResource | null>(null)
    const [loading, setLoading] = useState(false)
    // StrictMode runs effect setup/cleanup twice in development. A sequence id
    // invalidates stale fetches without suppressing the replacement request.
    const fetchSeq = useRef(0)
    const onMissingRef = useRef(onMissing)
    onMissingRef.current = onMissing

    // Workspace switch: nothing resolved in the previous workspace stays on screen.
    const [routeEpoch, setRouteEpoch] = useState(workspaceEpoch)
    if (routeEpoch !== workspaceEpoch) {
        setRouteEpoch(workspaceEpoch)
        setFetched(null)
        setCreateDraft(null)
    }

    // Create: mint a stable draft once per "new" session; clear it when leaving create.
    useEffect(() => {
        if (!isCreate) {
            setCreateDraft(null)
            return
        }
        setCreateDraft((current) => current ?? newLorebookResource(nextLorebookResourceFileName(items, resourceEdit?.createType ?? 'txt'), ''))
        // `items` is only read to pick a unique filename — intentionally not a dep (avoids re-minting).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCreate, resourceEdit?.createType, workspaceEpoch])

    // Cold deep-link: fetch a single resource that isn't in the loaded list.
    useEffect(() => {
        if (isCreate || !resourceId) {
            fetchSeq.current += 1
            setLoading(false)
            return
        }
        if (fromItems || fetched?.id === resourceId) {
            fetchSeq.current += 1
            setLoading(false)
            return
        }

        if (!isAuthenticated) {
            // Deep-linked while logged out: prompt login; the auth flip re-runs this effect.
            fetchSeq.current += 1
            setLoading(false)
            openLoginModal()
            return
        }
        // Private: wait for the workspace handshake; the committed client re-runs this effect.
        if (!api) {
            fetchSeq.current += 1
            return
        }

        const seq = fetchSeq.current + 1
        fetchSeq.current = seq
        const scope = capture()
        setLoading(true)
        void (async () => {
            try {
                const raw = await api.getLorebookResource(resourceId)
                const normalized = normalizeLorebookResource(raw)
                if (seq !== fetchSeq.current || !isCurrent(scope)) return
                if (!normalized) throw new Error('not-found')
                setFetched(normalized)
                upsertItem(normalized)
            } catch {
                if (seq !== fetchSeq.current || !isCurrent(scope)) return
                onMissingRef.current?.()
                setPage('gallery-resources')
            } finally {
                if (seq === fetchSeq.current) setLoading(false)
            }
        })()
        return () => {
            if (fetchSeq.current === seq) fetchSeq.current += 1
        }
        // `upsertItem`/`setPage`/`capture`/`isCurrent` are stable; depend on the inputs that change the decision.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resourceId, isCreate, fromItems, fetched?.id, isAuthenticated, api, workspaceEpoch])

    const resource = isCreate ? createDraft : fromItems ?? (fetched?.id === resourceId ? fetched : null)

    return { resource, isCreate, loading }
}
