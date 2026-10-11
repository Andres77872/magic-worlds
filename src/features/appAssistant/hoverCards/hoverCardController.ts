/**
 * HoverCardController — the timing and stacking rules of the hover cards, kept
 * outside React (an external store read with `useSyncExternalStore`) so timers
 * never see stale state.
 *
 * Rules (Paradox-style nested tooltips, WCAG 1.4.13 friendly):
 * - A link opens its card after a short rest; once a card has opened, the next
 *   one opens at once (warm), and Ctrl/Cmd opens immediately.
 * - Leaving the link or card closes it after a grace period, so the pointer
 *   can travel into the card. After `lockAfter` the card locks and stays until
 *   Escape, an outside click, or another link at its depth.
 * - Links inside a card open the next card of the stack (up to `HOVER_MAX_DEPTH`);
 *   pressing inside a card closes the cards deeper than it.
 * - Dragging a card tears it off the stack: it stays open (up to
 *   `HOVER_MAX_TORN`) until its close button, whatever else is hovered.
 */
import type { HoverCardRef } from './hoverCardModel'

export const HOVER_TIMING = {
    openDelay: 320,
    closeGrace: 240,
    lockAfter: 1000,
    /** A card that closed this recently makes the next one open instantly. */
    warmWindow: 600,
} as const

export const HOVER_MAX_DEPTH = 3
export const HOVER_MAX_TORN = 4

/** On a card's root element; its value is the card's uid. */
export const HOVER_CARD_ATTR = 'data-hover-card'
/** On every link that opens a card. */
export const HOVER_LINK_ATTR = 'data-hover-link'
/** Set on a link while its card is open (styling hook). */
export const HOVER_ACTIVE_ATTR = 'data-hover-active'

export interface HoverCardEntry {
    uid: number
    ref: HoverCardRef
    /** The link's own text: the title shown when the record cannot be found. */
    label: string
    /** The link the card follows; null once the card is torn off. */
    anchor: HTMLElement | null
    depth: number
    locked: boolean
    torn: boolean
}

export interface HoverCardsSnapshot {
    /** The open chain, outermost first. */
    stack: readonly HoverCardEntry[]
    /** Dragged cards, back to front. */
    torn: readonly HoverCardEntry[]
}

type Timer = ReturnType<typeof setTimeout>

export function hoverCardDomId(uid: number): string {
    return `hover-card-${uid}`
}

function markAnchor(anchor: HTMLElement, uid: number): void {
    anchor.setAttribute(HOVER_ACTIVE_ATTR, '')
    anchor.setAttribute('aria-describedby', hoverCardDomId(uid))
}

function unmarkAnchor(anchor: HTMLElement): void {
    anchor.removeAttribute(HOVER_ACTIVE_ATTR)
    anchor.removeAttribute('aria-describedby')
}

export class HoverCardController {
    private snapshot: HoverCardsSnapshot = { stack: [], torn: [] }
    private readonly listeners = new Set<() => void>()
    private openTimer: Timer | null = null
    private closeTimer: Timer | null = null
    private readonly lockTimers = new Map<number, Timer>()
    private lastCloseAt = Number.NEGATIVE_INFINITY
    private nextUid = 1
    private readonly now: () => number

    constructor(now: () => number = () => Date.now()) {
        this.now = now
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    getSnapshot = (): HoverCardsSnapshot => this.snapshot

    /** A link was hovered or keyboard-focused. */
    intent(anchor: HTMLElement, ref: HoverCardRef, options: { instant?: boolean } = {}): void {
        this.clearCloseTimer()
        this.clearOpenTimer()
        const depth = this.depthOf(anchor)
        if (depth >= HOVER_MAX_DEPTH) return
        if (this.snapshot.stack[depth]?.anchor === anchor) return
        const warm = this.now() - this.lastCloseAt < HOVER_TIMING.warmWindow || this.snapshot.stack.length > depth
        const delay = options.instant || warm ? 0 : HOVER_TIMING.openDelay
        this.openTimer = setTimeout(() => {
            this.openTimer = null
            if (anchor.isConnected) this.open(anchor, ref)
        }, delay)
    }

    /** The pointer (or focus) left a link. */
    leave(anchor: Element): void {
        this.scheduleClose(this.depthOf(anchor))
    }

    cardEnter(uid: number): void {
        this.clearCloseTimer()
        const entry = this.find(uid)
        if (!entry) return
        // Back in an outer card: the deeper, unlocked ones may go.
        const deeper = entry.torn ? 0 : entry.depth + 1
        if (this.snapshot.stack.length > deeper) this.scheduleClose(deeper)
    }

    cardLeave(uid: number): void {
        const entry = this.find(uid)
        if (entry && !entry.torn) this.scheduleClose(entry.depth)
    }

    /** A press inside a card (not on a link or control) closes the cards above it. */
    cardPress(uid: number): void {
        const entry = this.find(uid)
        if (!entry) return
        this.closeFrom(entry.torn ? 0 : entry.depth + 1)
        if (entry.torn) this.raise(uid)
    }

    /** Detach a card from its link so it stays open until closed. */
    tearOff(uid: number): void {
        const index = this.snapshot.stack.findIndex((entry) => entry.uid === uid)
        if (index < 0) return
        const entry = this.snapshot.stack[index]
        const kept = this.trim(index + 1).slice(0, index)
        this.clearLock(uid)
        if (entry.anchor) unmarkAnchor(entry.anchor)
        const torn = [...this.snapshot.torn, { ...entry, anchor: null, locked: true, torn: true }].slice(-HOVER_MAX_TORN)
        this.commit({ stack: kept, torn })
    }

    closeTorn(uid: number): void {
        const torn = this.snapshot.torn.filter((entry) => entry.uid !== uid)
        if (torn.length !== this.snapshot.torn.length) this.commit({ ...this.snapshot, torn })
    }

    /** Close the open chain (not the torn cards), e.g. on an outside click. */
    dismissTransient(): void {
        this.clearOpenTimer()
        this.clearCloseTimer()
        this.closeFrom(0)
    }

    /** Escape: close the topmost card of the chain. Returns false when nothing was open. */
    closeTop(): boolean {
        const count = this.snapshot.stack.length
        if (!count) return false
        this.closeFrom(count - 1)
        return true
    }

    dispose(): void {
        this.clearOpenTimer()
        this.clearCloseTimer()
        for (const timer of this.lockTimers.values()) clearTimeout(timer)
        this.lockTimers.clear()
        for (const entry of this.snapshot.stack) if (entry.anchor) unmarkAnchor(entry.anchor)
        this.snapshot = { stack: [], torn: [] }
        this.listeners.clear()
    }

    /** 0 for a link in the thread (or in a torn card); n + 1 for a link inside the stack's card n. */
    private depthOf(anchor: Element): number {
        const host = anchor.closest(`[${HOVER_CARD_ATTR}]`)
        if (!host) return 0
        const uid = Number(host.getAttribute(HOVER_CARD_ATTR))
        const index = this.snapshot.stack.findIndex((entry) => entry.uid === uid)
        return index < 0 ? 0 : index + 1
    }

    private open(anchor: HTMLElement, ref: HoverCardRef): void {
        const depth = this.depthOf(anchor)
        if (depth >= HOVER_MAX_DEPTH) return
        const kept = this.trim(depth)
        const entry: HoverCardEntry = {
            uid: this.nextUid++,
            ref,
            label: anchor.textContent?.trim() ?? '',
            anchor,
            depth,
            locked: false,
            torn: false,
        }
        markAnchor(anchor, entry.uid)
        this.lockTimers.set(entry.uid, setTimeout(() => this.lock(entry.uid), HOVER_TIMING.lockAfter))
        this.commit({ ...this.snapshot, stack: [...kept, entry] })
    }

    private lock(uid: number): void {
        this.lockTimers.delete(uid)
        if (!this.snapshot.stack.some((entry) => entry.uid === uid)) return
        this.commit({ ...this.snapshot, stack: this.snapshot.stack.map((entry) => (entry.uid === uid ? { ...entry, locked: true } : entry)) })
    }

    private scheduleClose(depth: number): void {
        this.clearOpenTimer()
        this.clearCloseTimer()
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null
            const { stack } = this.snapshot
            for (let index = depth; index < stack.length; index += 1) {
                if (!stack[index].locked) {
                    this.closeFrom(index)
                    return
                }
            }
        }, HOVER_TIMING.closeGrace)
    }

    private closeFrom(index: number): void {
        if (this.snapshot.stack.length <= index) return
        this.commit({ ...this.snapshot, stack: this.trim(index) })
    }

    /** Release the cards from `index` up (timers, link marks) and return the ones below. */
    private trim(index: number): HoverCardEntry[] {
        const { stack } = this.snapshot
        for (const entry of stack.slice(index)) {
            this.clearLock(entry.uid)
            if (entry.anchor) unmarkAnchor(entry.anchor)
        }
        if (stack.length > index) this.lastCloseAt = this.now()
        return stack.slice(0, index)
    }

    private raise(uid: number): void {
        const { torn } = this.snapshot
        const index = torn.findIndex((entry) => entry.uid === uid)
        if (index < 0 || index === torn.length - 1) return
        this.commit({ ...this.snapshot, torn: [...torn.slice(0, index), ...torn.slice(index + 1), torn[index]] })
    }

    private find(uid: number): HoverCardEntry | undefined {
        return this.snapshot.stack.find((entry) => entry.uid === uid) ?? this.snapshot.torn.find((entry) => entry.uid === uid)
    }

    private clearLock(uid: number): void {
        const timer = this.lockTimers.get(uid)
        if (timer !== undefined) clearTimeout(timer)
        this.lockTimers.delete(uid)
    }

    private clearOpenTimer(): void {
        if (this.openTimer !== null) clearTimeout(this.openTimer)
        this.openTimer = null
    }

    private clearCloseTimer(): void {
        if (this.closeTimer !== null) clearTimeout(this.closeTimer)
        this.closeTimer = null
    }

    private commit(next: HoverCardsSnapshot): void {
        this.snapshot = next
        for (const listener of this.listeners) listener()
    }
}
