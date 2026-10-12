/**
 * HoverCard — one open card: resolves its record (library first, then one
 * cached request), loads the portrait only now, follows its link while
 * transient, and tears off into a free-floating card once dragged (pointer
 * past a small threshold, or arrow keys on the handle).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { CardPreview } from '@/features/cards/cardPreview'
import { cx, useDraggable } from '@/ui/primitives'
import { focusLink, type KnowledgeLibrary } from '../appKnowledge'
import { loadRemotePreview, peekRemotePreview, useHoverMedia } from './hoverCardCache'
import { HOVER_CARD_ATTR, HOVER_MAX_DEPTH, type HoverCardController, type HoverCardEntry } from './hoverCardController'
import {
    hoverCardEditorHref,
    hoverCardFromLibrary,
    hoverCardFromPreview,
    type HoverCardModel,
    type HoverCardRef,
    type HoverNameIndex,
} from './hoverCardModel'
import { placeHoverCard } from './hoverCardPlacement'
import { HoverCardLink } from './HoverCardLink'
import { HoverCardView, type HoverCardData, type HoverCardFocusState } from './HoverCardView'

export interface HoverCardFocusApi {
    isInFocus: (ref: HoverCardRef) => boolean
    full: boolean
    busy: boolean
    limit: number
    tokens: (ref: HoverCardRef) => number
}

interface HoverCardProps {
    entry: HoverCardEntry
    controller: HoverCardController
    library: KnowledgeLibrary
    nameIndex: HoverNameIndex
    focus: HoverCardFocusApi
    onToggleFocus: (ref: HoverCardRef) => void
    onView: (ref: HoverCardRef) => void
}

const CARD_SIZE = { width: 300, height: 260 }
/** Pointer travel on the handle that turns a press into a drag (and tears the card off). */
const DRAG_THRESHOLD = 4
const NUDGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
const NESTED_LINK_CLASS = 'text-ember-300 underline decoration-ember-400/45 underline-offset-[3px] hover:text-ember-200 hover:decoration-current'

type RemoteState = { status: 'loading' } | { status: 'ready'; preview: CardPreview } | { status: 'missing' } | { status: 'error' }

function initialRemote(ref: HoverCardRef): RemoteState {
    const settled = peekRemotePreview(ref)
    if (settled === undefined) return { status: 'loading' }
    return settled ? { status: 'ready', preview: settled } : { status: 'missing' }
}

/**
 * The library record when it is there (no request); otherwise one cached fetch
 * by id. `retry` asks again after a failed request (failures are not cached).
 */
function useHoverCardData(ref: HoverCardRef, library: KnowledgeLibrary, t: TFunction): { data: HoverCardData; retry: () => void } {
    const local = useMemo(() => hoverCardFromLibrary(library, ref, t), [library, ref, t])
    // Lorebooks have no preview endpoint: outside the library they are simply gone.
    const remote = !local && ref.kind !== 'lorebook'
    const [state, setState] = useState<RemoteState>(() => initialRemote(ref))

    useEffect(() => {
        if (!remote || state.status !== 'loading') return
        let cancelled = false
        loadRemotePreview(ref).then(
            (preview) => {
                if (!cancelled) setState(preview ? { status: 'ready', preview } : { status: 'missing' })
            },
            () => {
                if (!cancelled) setState({ status: 'error' })
            },
        )
        return () => {
            cancelled = true
        }
    }, [remote, ref, state.status])

    const data = useMemo<HoverCardData>(() => {
        if (local) return { status: 'ready', model: local }
        if (!remote) return { status: 'missing', checked: false }
        if (state.status === 'ready') return { status: 'ready', model: hoverCardFromPreview(state.preview, ref) }
        if (state.status === 'missing') return { status: 'missing', checked: true }
        return state
    }, [local, remote, state, ref])
    return { data, retry: () => setState({ status: 'loading' }) }
}

function focusStateFor(model: HoverCardModel | null, focus: HoverCardFocusApi, t: TFunction): HoverCardFocusState | null {
    if (!model?.inLibrary) return null
    const inFocus = focus.isInFocus(model.ref)
    const blockedReason = focus.busy
        ? t('appAssistant.hoverCard.focusBusy')
        : !inFocus && focus.full ? t('appAssistant.hoverCard.focusFull', { limit: focus.limit }) : null
    return { inFocus, tokens: focus.tokens(model.ref), blockedReason }
}

export function HoverCard({ entry, controller, library, nameIndex, focus, onToggleFocus, onView }: HoverCardProps) {
    const { t } = useTranslation()
    const { ref: dragRef, position, style, dragHandleProps } = useDraggable({ viewportPadding: 8, defaultSize: CARD_SIZE })
    const pressRef = useRef<{ x: number; y: number } | null>(null)
    const { data, retry } = useHoverCardData(entry.ref, library, t)
    const model = data.status === 'ready' ? data.model : null
    const media = useHoverMedia(model?.imageUrl)
    const panelRef = dragRef as RefObject<HTMLDivElement | null>
    const { anchor, uid } = entry
    // Until the card is dragged (or nudged) it follows its link.
    const anchored = position === null && anchor !== null

    useLayoutEffect(() => {
        const panel = panelRef.current
        if (!anchored || !panel || !anchor) return
        const place = () => {
            if (!anchor.isConnected) return
            const host = anchor.closest(`[${HOVER_CARD_ATTR}]`)
            const { left, top } = placeHoverCard({
                anchor: anchor.getBoundingClientRect(),
                host: host ? host.getBoundingClientRect() : null,
                size: { width: panel.offsetWidth || CARD_SIZE.width, height: panel.offsetHeight || CARD_SIZE.height },
                viewport: { width: window.innerWidth, height: window.innerHeight },
            })
            panel.style.left = `${left}px`
            panel.style.top = `${top}px`
        }
        place()
        window.addEventListener('scroll', place, true)
        window.addEventListener('resize', place)
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
        observer?.observe(panel)
        return () => {
            window.removeEventListener('scroll', place, true)
            window.removeEventListener('resize', place)
            observer?.disconnect()
        }
    }, [anchored, anchor, panelRef])

    const handleProps = {
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
            pressRef.current = { x: event.clientX, y: event.clientY }
            dragHandleProps.onPointerDown(event)
        },
        onPointerMove: (event: PointerEvent<HTMLElement>) => {
            const start = pressRef.current
            if (start && !entry.torn && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= DRAG_THRESHOLD) {
                pressRef.current = null
                controller.tearOff(uid)
            }
            dragHandleProps.onPointerMove(event)
        },
        onPointerUp: (event: PointerEvent<HTMLElement>) => {
            pressRef.current = null
            dragHandleProps.onPointerUp(event)
        },
        onPointerCancel: (event: PointerEvent<HTMLElement>) => {
            pressRef.current = null
            dragHandleProps.onPointerCancel(event)
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (NUDGE_KEYS.has(event.key) && !entry.torn) controller.tearOff(uid)
            dragHandleProps.onKeyDown(event)
        },
    }

    // The deepest card of the chain shows plain text; a torn card starts a new chain.
    const canNest = entry.torn || entry.depth < HOVER_MAX_DEPTH - 1
    const focusState = focusStateFor(model, focus, t)

    return (
        <HoverCardView
            ref={panelRef}
            uid={uid}
            kind={model?.ref.kind ?? entry.ref.kind}
            label={entry.label}
            data={data}
            imageSrc={media.src}
            imageLoading={media.loading}
            locked={entry.locked}
            torn={entry.torn}
            focus={focusState}
            nameIndex={canNest ? nameIndex : null}
            renderLink={(ref, text, key) => (
                <HoverCardLink key={key} href={focusLink(ref)} showIcon={false} onActivate={onView} className={NESTED_LINK_CLASS}>
                    {text}
                </HoverCardLink>
            )}
            handleProps={handleProps}
            onClose={() => controller.closeTorn(uid)}
            onToggleFocus={model ? () => onToggleFocus(model.ref) : undefined}
            onView={model ? () => {
                controller.dismissTransient()
                onView(model.ref)
            } : undefined}
            // Only the reader's own records have an editor to open.
            editorHref={model?.inLibrary ? hoverCardEditorHref(model.ref) : null}
            onOpenEditor={() => controller.dismissTransient()}
            onRetry={retry}
            style={style}
            className={cx('fixed left-[-9999px] top-0', entry.torn ? 'z-[47]' : 'z-[48]')}
            onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') controller.cardEnter(uid)
            }}
            onPointerLeave={(event) => {
                if (event.pointerType !== 'touch') controller.cardLeave(uid)
            }}
            onPointerDown={(event) => {
                if ((event.target as Element).closest('a, button')) return
                controller.cardPress(uid)
            }}
        />
    )
}
