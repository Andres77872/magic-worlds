import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    HOVER_ACTIVE_ATTR,
    HOVER_CARD_ATTR,
    HOVER_MAX_DEPTH,
    HOVER_MAX_TORN,
    HOVER_TIMING,
    HoverCardController,
} from './hoverCardController'
import type { HoverCardRef } from './hoverCardModel'

const LYRA: HoverCardRef = { kind: 'character', id: 'c-lyra' }
const THERON: HoverCardRef = { kind: 'character', id: 'c-theron' }

function link(text: string, parent: Element = document.body): HTMLAnchorElement {
    const anchor = document.createElement('a')
    anchor.textContent = text
    parent.appendChild(anchor)
    return anchor
}

/** A stand-in for a rendered card, so links inside it resolve their depth. */
function cardElement(uid: number): HTMLDivElement {
    const element = document.createElement('div')
    element.setAttribute(HOVER_CARD_ATTR, String(uid))
    document.body.appendChild(element)
    return element
}

describe('HoverCardController', () => {
    let now = 0
    let controller: HoverCardController

    beforeEach(() => {
        vi.useFakeTimers()
        now = 10_000
        controller = new HoverCardController(() => now)
    })

    afterEach(() => {
        controller.dispose()
        vi.useRealTimers()
        document.body.innerHTML = ''
    })

    const advance = (ms: number) => {
        now += ms
        vi.advanceTimersByTime(ms)
    }

    it('opens after the rest delay, marks the link, and locks after a second', () => {
        const anchor = link('Lyra Brisaveloz')
        controller.intent(anchor, LYRA)
        advance(HOVER_TIMING.openDelay - 1)
        expect(controller.getSnapshot().stack).toHaveLength(0)
        advance(1)
        const [entry] = controller.getSnapshot().stack
        expect(entry).toMatchObject({ ref: LYRA, label: 'Lyra Brisaveloz', depth: 0, locked: false, torn: false })
        expect(anchor.hasAttribute(HOVER_ACTIVE_ATTR)).toBe(true)
        expect(anchor.getAttribute('aria-describedby')).toBe(`hover-card-${entry.uid}`)
        advance(HOVER_TIMING.lockAfter)
        expect(controller.getSnapshot().stack[0].locked).toBe(true)
    })

    it('never opens for a link the pointer only passed over', () => {
        const anchor = link('Lyra')
        controller.intent(anchor, LYRA)
        advance(100)
        controller.leave(anchor)
        advance(1000)
        expect(controller.getSnapshot().stack).toHaveLength(0)
    })

    it('opens instantly with Ctrl/Cmd and right after another card (warm)', () => {
        const first = link('Lyra')
        controller.intent(first, LYRA, { instant: true })
        advance(0)
        expect(controller.getSnapshot().stack).toHaveLength(1)
        controller.leave(first)
        advance(HOVER_TIMING.closeGrace)
        expect(controller.getSnapshot().stack).toHaveLength(0)
        controller.intent(link('Theron'), THERON)
        advance(0)
        expect(controller.getSnapshot().stack[0].ref).toEqual(THERON)
    })

    it('closes an unlocked card after the grace period unless the pointer reaches it', () => {
        const anchor = link('Lyra')
        controller.intent(anchor, LYRA)
        advance(HOVER_TIMING.openDelay)
        const { uid } = controller.getSnapshot().stack[0]
        controller.leave(anchor)
        advance(HOVER_TIMING.closeGrace - 50)
        controller.cardEnter(uid)
        advance(500)
        expect(controller.getSnapshot().stack).toHaveLength(1)
        controller.cardLeave(uid)
        advance(HOVER_TIMING.closeGrace)
        expect(controller.getSnapshot().stack).toHaveLength(0)
        expect(anchor.hasAttribute(HOVER_ACTIVE_ATTR)).toBe(false)
    })

    it('keeps a locked card when the pointer leaves', () => {
        const anchor = link('Lyra')
        controller.intent(anchor, LYRA)
        advance(HOVER_TIMING.openDelay + HOVER_TIMING.lockAfter)
        controller.leave(anchor)
        advance(2000)
        expect(controller.getSnapshot().stack).toHaveLength(1)
        expect(controller.closeTop()).toBe(true)
        expect(controller.getSnapshot().stack).toHaveLength(0)
        expect(controller.closeTop()).toBe(false)
    })

    it('nests cards from links inside a card and closes deeper ones on a press', () => {
        controller.intent(link('Lyra'), LYRA)
        advance(HOVER_TIMING.openDelay)
        const outer = controller.getSnapshot().stack[0]
        const inner = link('Theron Mistwood', cardElement(outer.uid))
        controller.intent(inner, THERON)
        advance(HOVER_TIMING.openDelay)
        expect(controller.getSnapshot().stack.map((entry) => entry.depth)).toEqual([0, 1])
        controller.cardPress(outer.uid)
        expect(controller.getSnapshot().stack).toHaveLength(1)
    })

    it('stops nesting at the maximum depth', () => {
        let parent: Element = document.body
        for (let depth = 0; depth < HOVER_MAX_DEPTH; depth += 1) {
            controller.intent(link(`card ${depth}`, parent), { kind: 'character', id: `c${depth}` })
            advance(HOVER_TIMING.openDelay)
            const { stack } = controller.getSnapshot()
            parent = cardElement(stack[stack.length - 1].uid)
        }
        controller.intent(link('too deep', parent), { kind: 'character', id: 'deep' })
        advance(HOVER_TIMING.openDelay)
        expect(controller.getSnapshot().stack).toHaveLength(HOVER_MAX_DEPTH)
    })

    it('replaces the card at the same depth when another thread link is hovered', () => {
        controller.intent(link('Lyra'), LYRA)
        advance(HOVER_TIMING.openDelay + HOVER_TIMING.lockAfter)
        controller.intent(link('Theron'), THERON)
        advance(0)
        const { stack } = controller.getSnapshot()
        expect(stack).toHaveLength(1)
        expect(stack[0].ref).toEqual(THERON)
    })

    it('tears a dragged card off the chain so nothing else closes it', () => {
        const anchor = link('Lyra')
        controller.intent(anchor, LYRA)
        advance(HOVER_TIMING.openDelay)
        const { uid } = controller.getSnapshot().stack[0]
        controller.tearOff(uid)
        expect(controller.getSnapshot().stack).toHaveLength(0)
        expect(controller.getSnapshot().torn[0]).toMatchObject({ uid, anchor: null, torn: true, locked: true })
        expect(anchor.hasAttribute(HOVER_ACTIVE_ATTR)).toBe(false)
        controller.dismissTransient()
        controller.cardLeave(uid)
        advance(5000)
        expect(controller.getSnapshot().torn).toHaveLength(1)
        controller.closeTorn(uid)
        expect(controller.getSnapshot().torn).toHaveLength(0)
    })

    it('keeps at most the newest torn cards', () => {
        for (let index = 0; index <= HOVER_MAX_TORN; index += 1) {
            controller.intent(link(`card ${index}`), { kind: 'character', id: `c${index}` }, { instant: true })
            advance(0)
            controller.tearOff(controller.getSnapshot().stack[0].uid)
        }
        const { torn } = controller.getSnapshot()
        expect(torn).toHaveLength(HOVER_MAX_TORN)
        expect(torn[0].ref.id).toBe('c1')
    })

    it('a link inside a torn card starts a new chain', () => {
        controller.intent(link('Lyra'), LYRA, { instant: true })
        advance(0)
        const { uid } = controller.getSnapshot().stack[0]
        controller.tearOff(uid)
        controller.intent(link('Theron', cardElement(uid)), THERON)
        advance(HOVER_TIMING.openDelay)
        expect(controller.getSnapshot().stack[0]).toMatchObject({ ref: THERON, depth: 0 })
    })

    it('notifies subscribers on every change', () => {
        const listener = vi.fn()
        const unsubscribe = controller.subscribe(listener)
        controller.intent(link('Lyra'), LYRA, { instant: true })
        advance(0)
        expect(listener).toHaveBeenCalledTimes(1)
        unsubscribe()
        controller.dismissTransient()
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
