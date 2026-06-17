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
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '@/infrastructure/api'
import { invalidateCardUsage } from '@/shared/hooks/useCardUsage'
import type { CardEditVersion } from '@/features/gallery/galleryLinks'
import type { CardDraftDocument, CardPublishResult, VersionableCardType } from '@/shared/types/cardVersion.types'

export interface CardDraftState {
    /** True when a private draft with unpublished edits exists. */
    hasDraft: boolean
    /** The published version the draft was forked from (drives "unsaved since v{n}"). */
    basedOnVersionNumber: number
    /** The current published latest version (the "Latest" marker / v{n} badge). */
    latestVersionNumber: number
}

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
    saveDraft: (body: unknown) => Promise<boolean>
    publish: (label?: string) => Promise<CardPublishResult | null>
    discard: () => Promise<CardDraftDocument | null>
    restoreIntoDraft: (versionNumber: number) => Promise<CardDraftDocument | null>
    refresh: () => Promise<void>
}

function toState(doc: CardDraftDocument): CardDraftState {
    return {
        hasDraft: doc.is_draft === true,
        basedOnVersionNumber: Number(doc.based_on_version_number ?? 0),
        latestVersionNumber: Number(doc.latest_version_number ?? 0),
    }
}

export function useCardDraft({ cardType, cardId, version, onDraftLoaded }: UseCardDraftOptions): UseCardDraftApi {
    const [draftState, setDraftState] = useState<CardDraftState | null>(null)
    const [isHistorical, setIsHistorical] = useState(false)
    const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // The body re-hydration must fire at most once per (card, version) — keyed so switching the
    // viewed version of the same card (e.g. drawer "View v2") re-hydrates while same-key stays put.
    const loadedFor = useRef<string | null>(null)
    const onDraftLoadedRef = useRef(onDraftLoaded)
    onDraftLoadedRef.current = onDraftLoaded

    const fetchDraft = useCallback(async (): Promise<CardDraftDocument | null> => {
        if (!cardId) return null
        try {
            return await apiService.getCardDraft(cardType, cardId)
        } catch {
            return null
        }
    }, [cardType, cardId])

    // On open (and when the target card or version changes), load the draft markers and resolve
    // the body to display per `version`. The draft doc is always fetched (for the has-draft/latest
    // badges); the hydrated body depends on the version selector.
    useEffect(() => {
        if (!cardId) {
            setDraftState(null)
            setIsHistorical(false)
            setViewingVersionNumber(null)
            return
        }
        const loadKey = `${cardId}:${version ?? 'default'}`
        let cancelled = false
        setLoading(true)
        void (async () => {
            const doc = await fetchDraft()
            if (cancelled) return
            if (doc) setDraftState(toState(doc))

            if (loadedFor.current === loadKey) {
                setLoading(false)
                return
            }
            loadedFor.current = loadKey

            if (typeof version === 'number') {
                // Read-only historical view — never touches the draft. Falls back to the draft/
                // published body already shown when the version no longer exists.
                const body = await apiService.getCardVersion(cardType, cardId, version).catch(() => null)
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
                const published = await apiService.getPublishedBody(cardType, cardId).catch(() => null)
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
    }, [cardId, version, cardType, fetchDraft])

    const refresh = useCallback(async () => {
        const doc = await fetchDraft()
        if (doc) setDraftState(toState(doc))
    }, [fetchDraft])

    const saveDraft = useCallback(
        async (body: unknown): Promise<boolean> => {
            if (!cardId) return false
            setSaving(true)
            setError(null)
            try {
                const doc = await apiService.saveCardDraft(cardType, cardId, body)
                setDraftState(toState(doc))
                return true
            } catch {
                setError('cardVersions.errors.draftSave')
                return false
            } finally {
                setSaving(false)
            }
        },
        [cardType, cardId],
    )

    const publish = useCallback(
        async (label?: string): Promise<CardPublishResult | null> => {
            if (!cardId) return null
            setPublishing(true)
            setError(null)
            try {
                const result = await apiService.publishCardDraft(cardType, cardId, label)
                // Publish changes the live card (latest bumps, draft cleared); usage display
                // for this card may now be stale in the shared cache.
                invalidateCardUsage(cardType, cardId)
                setDraftState({
                    hasDraft: false,
                    basedOnVersionNumber: result.version_number,
                    latestVersionNumber: result.version_number,
                })
                return result
            } catch {
                setError('cardVersions.errors.publish')
                return null
            } finally {
                setPublishing(false)
            }
        },
        [cardType, cardId],
    )

    const discard = useCallback(async (): Promise<CardDraftDocument | null> => {
        if (!cardId) return null
        setSaving(true)
        setError(null)
        try {
            await apiService.discardCardDraft(cardType, cardId)
            // No draft now → getCardDraft returns the published body the form should reset to.
            const published = await apiService.getCardDraft(cardType, cardId)
            setDraftState(toState(published))
            return published
        } catch {
            setError('cardVersions.errors.discard')
            return null
        } finally {
            setSaving(false)
        }
    }, [cardType, cardId])

    const restoreIntoDraft = useCallback(
        async (versionNumber: number): Promise<CardDraftDocument | null> => {
            if (!cardId) return null
            setSaving(true)
            setError(null)
            try {
                const doc = await apiService.restoreVersionIntoDraft(cardType, cardId, versionNumber)
                setDraftState(toState(doc))
                // Restore stages the version into the draft → we're now editing a draft, not viewing history.
                setIsHistorical(false)
                setViewingVersionNumber(null)
                return doc
            } catch {
                setError('cardVersions.errors.restoreDraft')
                return null
            } finally {
                setSaving(false)
            }
        },
        [cardType, cardId],
    )

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
    }
}
