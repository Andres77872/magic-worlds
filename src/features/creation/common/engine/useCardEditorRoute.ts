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
 */

import { useEffect, useRef, useState } from 'react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
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
    const data = useData()
    const [bootstrapping, setBootstrapping] = useState(false)
    // One attempt per (auth, card id): refetch on id change, retry after login, never loop.
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
        if (!routeId) return
        const key = `${isAuthenticated}:${routeId}`
        // Already editing the right card (gallery click, create→edit) — nothing to bootstrap.
        if (editing && editing.id === routeId) {
            attemptedFor.current = key
            return
        }
        if (attemptedFor.current === key) return
        attemptedFor.current = key

        if (!isAuthenticated) {
            // Deep-linked while logged out: prompt login; the auth flip re-runs this effect.
            openLoginModal()
            return
        }

        let cancelled = false
        setBootstrapping(true)
        void (async () => {
            try {
                if (cardType === 'character') {
                    const raw = await apiService.getCharacter(routeId)
                    const card = transformCharacters([raw])[0]
                    if (cancelled) return
                    if (!card?.id) throw new Error('not-found')
                    data.setEditingCharacter(card)
                    onCardLoadedRef.current?.(raw)
                } else if (cardType === 'world') {
                    const raw = await apiService.getWorld(routeId)
                    const card = transformWorlds([raw])[0]
                    if (cancelled) return
                    if (!card?.id) throw new Error('not-found')
                    data.setEditingWorld(card)
                    onCardLoadedRef.current?.(raw)
                } else {
                    const raw = await apiService.getItem(routeId)
                    const card = transformItems([raw])[0]
                    if (cancelled) return
                    if (!card?.id) throw new Error('not-found')
                    data.setEditingItem(card)
                    onCardLoadedRef.current?.(raw)
                }
            } catch {
                // Card deleted / not owned / unreachable → bounce to the gallery (the useful fallback).
                if (!cancelled) setPage(GALLERY_PAGE[cardType])
            } finally {
                if (!cancelled) setBootstrapping(false)
            }
        })()
        return () => {
            cancelled = true
        }
        // `data` setters are stable; depend on the inputs that change the decision.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeId, editing, isAuthenticated, cardType, setPage, openLoginModal])

    return { bootstrapping, version, routeCardId: routeId ?? editing?.id ?? null }
}
