/**
 * useCardDraft — the shared draft/publish lifecycle for the card editors
 * (character / world / item). One place all three creators get the draft buffer.
 *
 * Model: editing writes to a PRIVATE draft (never the live card that sessions clone).
 * Publish promotes the draft → live and cuts a new version; Discard reverts to published;
 * Restore loads an earlier version into the draft for review. The hook owns the server
 * choreography + a small `draftState` (has_draft / based_on / latest); it does NOT own the
 * form fields — the creator passes `onDraftLoaded` (initial pending draft) and re-hydrates
 * itself from the bodies returned by discard/restore.
 *
 * Every write names the body the editor loaded (its `draft_stamp`, sent as `If-Match`). A draft a
 * novel changed meanwhile (a staged fact) is refused instead of overwritten, published unseen or
 * thrown away: the hook records the refused action as `conflict` until the author loads the newer
 * draft or chooses to keep their own.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/infrastructure/api'
import { invalidateCardUsage } from '@/shared/hooks/useCardUsage'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import type { CardEditVersion } from '@/features/gallery/galleryLinks'
import type { CardDraftDocument, CardPublishResult, VersionableCardType } from '@/shared/types/cardVersion.types'
import { voiceSaveErrorKey } from './useCreatorWorkspace'

export interface CardDraftState {
    /** True when a private draft with unpublished edits exists. */
    hasDraft: boolean
    /** The published version the draft was forked from (drives "unsaved since v{n}"). */
    basedOnVersionNumber: number
    /** The current published latest version (the "Latest" marker / v{n} badge). */
    latestVersionNumber: number
}

/** The editor write the server refused because the card's draft changed since the editor loaded it. */
export type CardDraftConflict =
    | { action: 'save'; body: unknown }
    | { action: 'publish' }
    | { action: 'discard' }
    | { action: 'restore'; versionNumber: number }

/** True when an editor write was refused because the card's draft changed elsewhere (a novel staged a fact). */
export function isDraftChanged(cause: unknown): boolean {
    return cause instanceof ApiError && cause.status === 409 && cause.code === 'CARD_DRAFT_CHANGED'
}

type WriteOptions = { onError?: (error: unknown) => void }

export interface UseCardDraftOptions {
    cardType: VersionableCardType
    /** The saved card id, or null while a brand-new card hasn't been created yet. */
    cardId: string | null
    /**
     * Which body to hydrate the form with (from the URL `?version=`):
     *   • `undefined` / `'draft'` — the private draft when one exists, else the editor's body stands.
     *   • `'latest'` — the latest published body (any draft is ignored for display).
     *   • a number — that historical version, loaded READ-ONLY (never overwrites the draft).
     */
    version?: CardEditVersion
    /**
     * Called when a body is resolved for the form (a pending draft, the latest published body, or a
     * historical version) — so the creator re-hydrates its fields. Fires once per (card, version).
     */
    onDraftLoaded?: (body: CardDraftDocument) => void
    /**
     * Workspace R1: the card's own workspace (its organization, or where it was
     * just created). Default = the committed workspace. Never sends initial collections.
     */
    workspaceId?: string | null
}

export interface UseCardDraftApi {
    draftState: CardDraftState | null
    hasDraft: boolean
    /** True while the editor is showing a read-only historical version (URL `?version=<n>`). */
    isHistorical: boolean
    /** The historical version number being viewed, or null when not viewing one. */
    viewingVersionNumber: number | null
    loading: boolean
    saving: boolean
    publishing: boolean
    busy: boolean
    /** i18n key for the last failed operation, or null. */
    error: string | null
    clearError: () => void
    /**
     * Save the form into the private draft. A voice write refusal (I-36) sets its
     * `voices.errors.*` key instead of the generic one; `onError` receives the
     * failure so the editor can point at the refused field.
     */
    saveDraft: (body: unknown, options?: WriteOptions) => Promise<boolean>
    publish: (label?: string, options?: WriteOptions) => Promise<CardPublishResult | null>
    discard: (options?: WriteOptions) => Promise<CardDraftDocument | null>
    restoreIntoDraft: (versionNumber: number, options?: WriteOptions) => Promise<CardDraftDocument | null>
    refresh: () => Promise<void>
    /** The write refused because the draft changed since the editor loaded it, or null. */
    conflict: CardDraftConflict | null
    /** Read the card's draft as stored now and hold it as the editor's body; the caller re-hydrates the form. */
    loadLatest: () => Promise<CardDraftDocument | null>
    /**
     * Hold the stamp of the draft as stored now without loading it, so the next write replaces it on purpose.
     * False when the card could not be read.
     */
    adoptLatest: () => Promise<boolean>
    dismissConflict: () => void
}

function toState(doc: CardDraftDocument): CardDraftState {
    return {
        hasDraft: doc.is_draft === true,
        basedOnVersionNumber: Number(doc.based_on_version_number ?? 0),
        latestVersionNumber: Number(doc.latest_version_number ?? 0),
    }
}

export function useCardDraft({ cardType, cardId, version, onDraftLoaded, workspaceId }: UseCardDraftOptions): UseCardDraftApi {
    const api = useScopedApi(workspaceId)
    const [draftState, setDraftState] = useState<CardDraftState | null>(null)
    const [isHistorical, setIsHistorical] = useState(false)
    const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [conflict, setConflict] = useState<CardDraftConflict | null>(null)
    // The stamp of the body this editor loaded or last wrote; every write sends it back as If-Match.
    const stampRef = useRef<string | null>(null)
    // Changing the callback must not restart a load or overwrite ongoing edits.
    // The effect dependencies already limit hydration to card/version transitions.
    const onDraftLoadedRef = useRef(onDraftLoaded)
    onDraftLoadedRef.current = onDraftLoaded

    const fetchDraft = useCallback(async (): Promise<CardDraftDocument | null> => {
        if (!cardId || !api) return null
        try {
            return await api.getCardDraft(cardType, cardId)
        } catch {
            return null
        }
    }, [api, cardType, cardId])

    // On open (and when the target card or version changes), load the draft markers and resolve
    // the body to display per `version`. The draft doc is always fetched (for the has-draft/latest
    // badges); the hydrated body depends on the version selector.
    useEffect(() => {
        stampRef.current = null
        setConflict(null)
        if (!cardId || !api) {
            setDraftState(null)
            setIsHistorical(false)
            setViewingVersionNumber(null)
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        void (async () => {
            const doc = await fetchDraft()
            if (cancelled) return
            if (doc) {
                setDraftState(toState(doc))
                stampRef.current = doc.draft_stamp ?? null
            }

            if (typeof version === 'number') {
                // Read-only historical view — never touches the draft. Falls back to the draft/
                // published body already shown when the version no longer exists.
                const body = await api.getCardVersion(cardType, cardId, version).catch(() => null)
                if (cancelled) return
                if (body) {
                    setIsHistorical(true)
                    setViewingVersionNumber(version)
                    onDraftLoadedRef.current?.(body)
                } else {
                    setIsHistorical(false)
                    setViewingVersionNumber(null)
                    if (doc?.is_draft === true) onDraftLoadedRef.current?.(doc)
                }
            } else if (version === 'latest') {
                setIsHistorical(false)
                setViewingVersionNumber(null)
                const published = await api.getPublishedBody(cardType, cardId).catch(() => null)
                if (cancelled) return
                if (published) onDraftLoadedRef.current?.(published)
            } else {
                // undefined / 'draft': hydrate from the draft only when one exists; otherwise the
                // body the editor already mounted with (or the bootstrap fetch loaded) stands.
                setIsHistorical(false)
                setViewingVersionNumber(null)
                if (doc?.is_draft === true) onDraftLoadedRef.current?.(doc)
            }
            if (!cancelled) setLoading(false)
        })()
        return () => {
            cancelled = true
        }
    }, [api, cardId, version, cardType, fetchDraft])

    const refresh = useCallback(async () => {
        const doc = await fetchDraft()
        if (doc) setDraftState(toState(doc))
    }, [fetchDraft])

    /** A refused write is either a changed draft (kept as `conflict`) or `fallback`'s error key. */
    const refuse = useCallback((cause: unknown, refused: CardDraftConflict, fallback: string, options?: WriteOptions) => {
        if (isDraftChanged(cause)) {
            setConflict(refused)
            setError('cardVersions.errors.draftChanged')
        } else {
            setError(fallback)
        }
        options?.onError?.(cause)
    }, [])

    const saveDraft = useCallback(
        async (body: unknown, options?: WriteOptions): Promise<boolean> => {
            if (!cardId || !api) return false
            setSaving(true)
            setError(null)
            try {
                const doc = await api.saveCardDraft(cardType, cardId, body, stampRef.current ?? undefined)
                setDraftState(toState(doc))
                stampRef.current = doc.draft_stamp ?? null
                setConflict(null)
                return true
            } catch (cause) {
                refuse(cause, { action: 'save', body }, voiceSaveErrorKey(cause) ?? 'cardVersions.errors.draftSave', options)
                return false
            } finally {
                setSaving(false)
            }
        },
        [api, cardType, cardId, refuse],
    )

    const publish = useCallback(
        async (label?: string, options?: WriteOptions): Promise<CardPublishResult | null> => {
            if (!cardId || !api) return null
            setPublishing(true)
            setError(null)
            try {
                const result = await api.publishCardDraft(cardType, cardId, label, stampRef.current ?? undefined)
                stampRef.current = result.draft_stamp ?? null
                setConflict(null)
                // Publish changes the live card (latest bumps, draft cleared); usage display
                // for this card may now be stale in the shared cache.
                invalidateCardUsage(cardType, cardId)
                setDraftState({
                    hasDraft: false,
                    basedOnVersionNumber: result.version_number,
                    latestVersionNumber: result.version_number,
                })
                return result
            } catch (cause) {
                refuse(cause, { action: 'publish' }, 'cardVersions.errors.publish', options)
                return null
            } finally {
                setPublishing(false)
            }
        },
        [api, cardType, cardId, refuse],
    )

    const discard = useCallback(async (options?: WriteOptions): Promise<CardDraftDocument | null> => {
        if (!cardId || !api) return null
        setSaving(true)
        setError(null)
        try {
            await api.discardCardDraft(cardType, cardId, stampRef.current ?? undefined)
            // No draft now → getCardDraft returns the published body the form should reset to.
            const published = await api.getCardDraft(cardType, cardId)
            setDraftState(toState(published))
            stampRef.current = published.draft_stamp ?? null
            setConflict(null)
            return published
        } catch (cause) {
            refuse(cause, { action: 'discard' }, 'cardVersions.errors.discard', options)
            return null
        } finally {
            setSaving(false)
        }
    }, [api, cardType, cardId, refuse])

    const restoreIntoDraft = useCallback(
        async (versionNumber: number, options?: WriteOptions): Promise<CardDraftDocument | null> => {
            if (!cardId || !api) return null
            setSaving(true)
            setError(null)
            try {
                const doc = await api.restoreVersionIntoDraft(cardType, cardId, versionNumber, stampRef.current ?? undefined)
                setDraftState(toState(doc))
                stampRef.current = doc.draft_stamp ?? null
                setConflict(null)
                // Restore stages the version into the draft → we're now editing a draft, not viewing history.
                setIsHistorical(false)
                setViewingVersionNumber(null)
                return doc
            } catch (cause) {
                refuse(cause, { action: 'restore', versionNumber }, 'cardVersions.errors.restoreDraft', options)
                return null
            } finally {
                setSaving(false)
            }
        },
        [api, cardType, cardId, refuse],
    )

    const loadLatest = useCallback(async (): Promise<CardDraftDocument | null> => {
        setLoading(true)
        const doc = await fetchDraft()
        setLoading(false)
        if (!doc) {
            setError('cardVersions.errors.loadLatest')
            return null
        }
        setDraftState(toState(doc))
        stampRef.current = doc.draft_stamp ?? null
        setConflict(null)
        setError(null)
        return doc
    }, [fetchDraft])

    const adoptLatest = useCallback(async (): Promise<boolean> => {
        const doc = await fetchDraft()
        if (!doc) {
            setError('cardVersions.errors.loadLatest')
            return false
        }
        setDraftState(toState(doc))
        stampRef.current = doc.draft_stamp ?? null
        return true
    }, [fetchDraft])

    return {
        draftState,
        hasDraft: draftState?.hasDraft ?? false,
        isHistorical,
        viewingVersionNumber,
        loading,
        saving,
        publishing,
        busy: loading || saving || publishing,
        error,
        clearError: useCallback(() => setError(null), []),
        saveDraft,
        publish,
        discard,
        restoreIntoDraft,
        refresh,
        conflict,
        loadLatest,
        adoptLatest,
        dismissConflict: useCallback(() => setConflict(null), []),
    }
}
