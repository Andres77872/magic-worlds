/**
 * Bottom-right chrome stack.
 *
 * Three independent surfaces all rested at the same corner coordinates
 * (`bottom-5 right-5`): the playlist dock, the creator assistant's launcher, and
 * the toast. They painted straight on top of one another — a toast hid the
 * dock's transport controls, and the launcher permanently covered the dock's
 * corner — because none of them knew the others existed.
 *
 * Persistent chrome now publishes its measured height here, and everything
 * stacked above it reads the accumulated inset. Slots are ordered bottom-up:
 * whatever is present is stacked, whatever is absent contributes nothing.
 *
 * Transient chrome (the toast) reads `useBottomChromeInset('toast')` and so
 * clears everything below it; the launcher reads `'launcher'` and clears the
 * banner and the dock; the dock reads `'dock'` and clears the consent banner.
 * A surface may both publish its own slot and consume the inset of that slot —
 * a slot never counts itself, so there is no feedback loop.
 */
import { useSyncExternalStore } from 'react'

/** Bottom-up order. Each slot sits above every slot before it. */
const SLOTS = ['banner', 'dock', 'launcher', 'toast'] as const

export type BottomChromeSlot = (typeof SLOTS)[number]

/** Vertical breathing room between two stacked surfaces. */
const GAP = 12

const heights = new Map<BottomChromeSlot, number>()
const listeners = new Set<() => void>()

function emit(): void {
    for (const listener of listeners) listener()
}

/**
 * Publish (or with `null`, retract) the height of a persistent bottom-right
 * surface. Call from a layout effect with the element's measured height.
 */
export function setBottomChromeHeight(slot: BottomChromeSlot, height: number | null): void {
    const previous = heights.get(slot)
    if (height === null) {
        if (previous === undefined) return
        heights.delete(slot)
    } else {
        const next = Math.max(0, Math.round(height))
        if (previous === next) return
        heights.set(slot, next)
    }
    emit()
}

function insetFor(slot: BottomChromeSlot): number {
    let inset = 0
    for (const candidate of SLOTS) {
        if (candidate === slot) break
        const height = heights.get(candidate)
        if (height) inset += height + GAP
    }
    return inset
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/**
 * Pixels a surface in `slot` must clear to sit above the persistent chrome
 * below it. `0` when nothing is below.
 */
export function useBottomChromeInset(slot: BottomChromeSlot): number {
    return useSyncExternalStore(
        subscribe,
        () => insetFor(slot),
        () => 0,
    )
}
