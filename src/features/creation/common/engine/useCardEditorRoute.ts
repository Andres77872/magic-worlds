/**
 * useCardEditorRoute — restores a card editor from a deep-link / refresh.
 *
 * The editor's "which card am I editing" lives in DataProvider (`editing{Character,World,Item}`),
 * which resets to null on reload. When the URL carries `#/<type>?card=<id>` but no card is in
 * memory (cold refresh, shared link), this hook fetches the card by id and sets it as the editing
 * entity, and forwards the body to the creator so its form fields hydrate (the creator's `useState`
 * initializers don't re-run after mount). The `version` from the URL is returned for the creator to
 * pass into {@link useCardDraft}, which resolves draft / latest / a specific version.
 *
 * Normal in-app navigation (gallery click) already sets the editing entity before the creator
 * mounts, so this hook no-ops there — it's purely the refresh/deep-link safety net.
 *
 * Workspace R1: the card is read in the committed workspace (the URL's workspace was validated
 * and committed before the route rendered); a result that lands after a switch is ignored.
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { transformCharacters, transformItems, transformWorlds } from '@/utils/cardTransforms'
import type { CardEditType, CardEditVersion } from '@/features/gallery/galleryLinks'
import type { PageType } from '@/shared'

export interface UseCardEditorRouteOptions {
    /**
     * Re-seed the creator's form from the freshly-fetched card body (the raw API response).
     * Fires only on the deep-link bootstrap path — not on normal gallery navigation.
     */
    onCardLoaded?: (rawCard: unknown) => void
}

export interface UseCardEditorRouteResult {
    /** True while the deep-linked card is being fetched — suppress the "create" template gallery. */
    bootstrapping: boolean
    /** The version selector from the URL (`draft` | `latest` | n), forwarded to useCardDraft. */
    version?: CardEditVersion
    /** The card id this editor is bound to (from the URL, else the in-memory editing card). */
    routeCardId: string | null
}

const GALLERY_PAGE: Record<CardEditType, PageType> = {
    character: 'gallery-characters',
    world: 'gallery-worlds',
    item: 'gallery-items',
}

export function useCardEditorRoute(
    cardType: CardEditType,
    { onCardLoaded }: UseCardEditorRouteOptions = {},
): UseCardEditorRouteResult {
    const { cardEdit, setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { api, capture, isCurrent } = useWorkspace()
    const data = useData()
    const [bootstrapping, setBootstrapping] = useState(false)
    // One active attempt per (type, auth, card id); cancelled effects must be able to retry.
    const attemptedFor = useRef<string | null>(null)
    const onCardLoadedRef = useRef(onCardLoaded)
    onCardLoadedRef.current = onCardLoaded

    // Only act when the live route targets THIS editor type.
    const target = cardEdit && cardEdit.cardType === cardType ? cardEdit : null
    const routeId = target?.cardId ?? null
    const version = target?.version

    const editing =
        cardType === 'character' ? data.editingCharacter : cardType === 'world' ? data.editingWorld : data.editingItem

    useEffect(() => {
        if (!routeId) {
            attemptedFor.current = null
            setBootstrapping(false)
            return
        }
        const key = `${cardType}:${isAuthenticated}:${routeId}:${api?.workspaceScope?.workspaceId ?? ''}`
        // Already editing the right card (gallery click, create→edit) — nothing to bootstrap.
        if (editing && editing.id === routeId) {
            attemptedFor.current = key
            setBootstrapping(false)
            return
        }
        if (attemptedFor.current === key) return
        attemptedFor.current = key

        if (!isAuthenticated) {
            // Deep-linked while logged out: prompt login; the auth flip re-runs this effect.
            setBootstrapping(false)
            openLoginModal()
            return
        }
        // Private read: wait for the workspace handshake (the effect re-runs once it lands).
        if (!api) {
            attemptedFor.current = null
            setBootstrapping(true)
            return
        }

        let cancelled = false
        const scope = capture()
        const stale = () => cancelled || !isCurrent(scope)
        setBootstrapping(true)
        void (async () => {
            try {
                if (cardType === 'character') {
                    const raw = await api.getCharacter(routeId)
                    const card = transformCharacters([raw])[0]
                    if (stale()) return
                    if (!card?.id) throw new Error('not-found')
                    data.setEditingCharacter(card)
                    onCardLoadedRef.current?.(raw)
                } else if (cardType === 'world') {
                    const raw = await api.getWorld(routeId)
                    const card = transformWorlds([raw])[0]
                    if (stale()) return
                    if (!card?.id) throw new Error('not-found')
                    data.setEditingWorld(card)
                    onCardLoadedRef.current?.(raw)
                } else {
                    const raw = await api.getItem(routeId)
                    const card = transformItems([raw])[0]
                    if (stale()) return
                    if (!card?.id) throw new Error('not-found')
                    data.setEditingItem(card)
                    onCardLoadedRef.current?.(raw)
                }
            } catch {
                // Card deleted / not owned / unreachable → bounce to the gallery (the useful fallback).
                if (!stale()) setPage(GALLERY_PAGE[cardType])
            } finally {
                if (!stale()) setBootstrapping(false)
            }
        })()
        return () => {
            cancelled = true
            // StrictMode replays mount effects, and route/auth changes can interrupt a fetch.
            // Its ignored result cannot satisfy the next effect's load attempt.
            if (attemptedFor.current === key) attemptedFor.current = null
        }
        // `data` setters are stable; depend on the inputs that change the decision.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeId, editing, isAuthenticated, api, cardType, setPage, openLoginModal])

    return { bootstrapping, version, routeCardId: routeId ?? editing?.id ?? null }
}
