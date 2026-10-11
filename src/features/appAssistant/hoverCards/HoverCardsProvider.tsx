/**
 * HoverCardsProvider — turns library links inside its subtree into hover
 * previews (render links with `HoverCardLink`) and paints the open cards in a
 * body portal, so the thread's scroll container cannot clip them.
 *
 * Escape closes the topmost transient card unless a modal or drawer owns it;
 * a press outside every card and link closes the chain. Torn (dragged) cards
 * only close with their own button, or when the page unmounts.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { openLayerCount } from '@/ui/primitives/layerStack'
import type { FocusRef, KnowledgeLibrary } from '../appKnowledge'
import { HOVER_CARD_ATTR, HOVER_LINK_ATTR, HoverCardController } from './hoverCardController'
import { buildHoverNameIndex, focusMatchKey, type HoverCardRef } from './hoverCardModel'
import { HoverCardsContext, type HoverCardsContextValue } from './hoverCardsContext'
import { HoverCard, type HoverCardFocusApi } from './HoverCard'

export interface HoverCardsProviderProps {
    /** The signed-in user's library: cards in it preview with no request. */
    library: KnowledgeLibrary
    /** The assistant's focus shelf. */
    focus: readonly FocusRef[]
    focusLimit: number
    /** Focus is locked while a reply streams (it is read when a question is sent). */
    focusBusy: boolean
    /** Rough token cost of reading a record in full. */
    focusTokens: (ref: HoverCardRef) => number
    onToggleFocus: (ref: HoverCardRef) => void
    /** Open a record the way clicking its link does. */
    onOpen: (ref: HoverCardRef) => void
    children: ReactNode
}

export function HoverCardsProvider({ library, focus, focusLimit, focusBusy, focusTokens, onToggleFocus, onOpen, children }: HoverCardsProviderProps) {
    const [controller] = useState(() => new HoverCardController())
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    const hasChain = snapshot.stack.length > 0

    useEffect(() => () => controller.dispose(), [controller])

    useEffect(() => {
        if (!hasChain) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || openLayerCount() > 0) return
            if (controller.closeTop()) event.stopPropagation()
        }
        const onPointerDown = (event: globalThis.PointerEvent) => {
            const target = event.target instanceof Element ? event.target : null
            if (target?.closest(`[${HOVER_CARD_ATTR}], [${HOVER_LINK_ATTR}]`)) return
            controller.dismissTransient()
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('pointerdown', onPointerDown, true)
        }
    }, [hasChain, controller])

    const nameIndex = useMemo(() => buildHoverNameIndex(library), [library])
    const focusKeys = useMemo(() => new Set(focus.map(focusMatchKey)), [focus])

    const value = useMemo<HoverCardsContextValue>(() => ({
        controller,
        isInFocus: (ref) => focusKeys.has(focusMatchKey(ref)),
    }), [controller, focusKeys])

    const focusApi = useMemo<HoverCardFocusApi>(() => ({
        isInFocus: (ref) => focusKeys.has(focusMatchKey(ref)),
        full: focus.length >= focusLimit,
        busy: focusBusy,
        limit: focusLimit,
        tokens: focusTokens,
    }), [focusKeys, focus.length, focusLimit, focusBusy, focusTokens])

    const cards = [...snapshot.torn, ...snapshot.stack]
    return (
        <HoverCardsContext.Provider value={value}>
            {children}
            {cards.length > 0 && typeof document !== 'undefined' && createPortal(
                cards.map((entry) => (
                    <HoverCard
                        key={entry.uid}
                        entry={entry}
                        controller={controller}
                        library={library}
                        nameIndex={nameIndex}
                        focus={focusApi}
                        onToggleFocus={onToggleFocus}
                        onOpen={onOpen}
                    />
                )),
                document.body,
            )}
        </HoverCardsContext.Provider>
    )
}
