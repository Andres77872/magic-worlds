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
import { invalidateCardUsage } from '@/shared/hooks/useCardUsage'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import type { CardEditVersion } from '@/features/gallery/galleryLinks'
import type { CardDraftDocument, CardPublishResult, VersionableCardType } from '@/shared/types/cardVersion.types'
import { voiceSaveError } from './useCreatorWorkspace'

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
     * failure so the editor can offer an action (409 `voice_reload_required`).
     */
    saveDraft: (body: unknown, options?: { onError?: (error: unknown) => void }) => Promise<boolean>
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

export function useCardDraft({ cardType, cardId, version, onDraftLoaded, workspaceId }: UseCardDraftOptions): UseCardDraftApi {
    const api = useScopedApi(workspaceId)
    const [draftState, setDraftState] = useState<CardDraftState | null>(null)
    const [isHistorical, setIsHistorical] = useState(false)
    const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [error, setError] = useState<string | null>(null)
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
            if (doc) setDraftState(toState(doc))

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

    const saveDraft = useCallback(
        async (body: unknown, options?: { onError?: (error: unknown) => void }): Promise<boolean> => {
            if (!cardId || !api) return false
            setSaving(true)
            setError(null)
            try {
                const doc = await api.saveCardDraft(cardType, cardId, body)
                setDraftState(toState(doc))
                return true
            } catch (cause) {
                setError(voiceSaveError(cause)?.key ?? 'cardVersions.errors.draftSave')
                options?.onError?.(cause)
                return false
            } finally {
                setSaving(false)
            }
        },
        [api, cardType, cardId],
    )

    const publish = useCallback(
        async (label?: string): Promise<CardPublishResult | null> => {
            if (!cardId || !api) return null
            setPublishing(true)
            setError(null)
            try {
                const result = await api.publishCardDraft(cardType, cardId, label)
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
        [api, cardType, cardId],
    )

    const discard = useCallback(async (): Promise<CardDraftDocument | null> => {
        if (!cardId || !api) return null
        setSaving(true)
        setError(null)
        try {
            await api.discardCardDraft(cardType, cardId)
            // No draft now → getCardDraft returns the published body the form should reset to.
            const published = await api.getCardDraft(cardType, cardId)
            setDraftState(toState(published))
            return published
        } catch {
            setError('cardVersions.errors.discard')
            return null
        } finally {
            setSaving(false)
        }
    }, [api, cardType, cardId])

    const restoreIntoDraft = useCallback(
        async (versionNumber: number): Promise<CardDraftDocument | null> => {
            if (!cardId || !api) return null
            setSaving(true)
            setError(null)
            try {
                const doc = await api.restoreVersionIntoDraft(cardType, cardId, versionNumber)
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
        [api, cardType, cardId],
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
