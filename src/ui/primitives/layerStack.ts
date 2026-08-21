/**
 * Global overlay layer stack — one shared source of truth for "which dismissable
 * layer is on top" and for the page scroll lock.
 *
 * Two problems this solves, both of which show up the moment overlays stack (a
 * Modal opened from a Drawer, an ImageLightbox opened from either):
 *
 * 1. **Escape closed everything at once.** Every open layer registered its own
 *    `document` keydown listener, so one Escape ran all of them. Layers now
 *    register here and only the TOP layer acts on Escape (and owns the Tab trap).
 *
 * 2. **The scroll lock locked the wrong element, and did not nest.** The app's
 *    scroller is `<main data-app-main>` (`h-screen overflow-y-auto`), not
 *    `<body>` — so `body { overflow: hidden }` never stopped anything. And each
 *    layer saved/restored the previous value independently, so a second layer
 *    captured the first layer's `hidden` and restored *that* on close, leaving
 *    the page permanently locked once the real target was fixed. The lock is now
 *    ref-counted and applied to the real scroller, compensating the scrollbar
 *    width so locking does not shift the layout.
 */

/** The app's scroll container (AppRouter's `<main data-app-main>`). */
function scrollContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null
    return document.querySelector<HTMLElement>('[data-app-main]')
}

// ---------------------------------------------------------------- scroll lock

let lockCount = 0
let releaseLock: (() => void) | null = null

function applyScrollLock(): void {
    if (typeof document === 'undefined') return
    const body = document.body
    const main = scrollContainer()
    const target = main ?? body
    // Reserve the space the scrollbar occupied so hiding it does not shift content.
    const gutter = target.offsetWidth - target.clientWidth
    const prev = {
        bodyOverflow: body.style.overflow,
        targetOverflow: target.style.overflow,
        targetPadding: target.style.paddingRight,
    }
    body.style.overflow = 'hidden'
    target.style.overflow = 'hidden'
    if (gutter > 0) {
        const current = Number.parseFloat(getComputedStyle(target).paddingRight) || 0
        target.style.paddingRight = `${current + gutter}px`
    }
    releaseLock = () => {
        body.style.overflow = prev.bodyOverflow
        target.style.overflow = prev.targetOverflow
        target.style.paddingRight = prev.targetPadding
    }
}

/** Lock page scrolling. Ref-counted: nested layers each lock and unlock once. */
export function lockScroll(): void {
    lockCount += 1
    if (lockCount === 1) applyScrollLock()
}

/** Release one scroll lock. The page unlocks when the last layer releases. */
export function unlockScroll(): void {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
        releaseLock?.()
        releaseLock = null
    }
}

// ---------------------------------------------------------------- layer stack

const stack: symbol[] = []

/** Register a layer as opened and return its handle. */
export function pushLayer(description = 'layer'): symbol {
    const id = Symbol(description)
    stack.push(id)
    return id
}

/** Remove a layer from the stack (safe to call for an id already removed). */
export function popLayer(id: symbol): void {
    const index = stack.lastIndexOf(id)
    if (index !== -1) stack.splice(index, 1)
}

/** True when `id` is the frontmost open layer — the one that owns Escape/Tab. */
export function isTopLayer(id: symbol): boolean {
    return stack.length > 0 && stack[stack.length - 1] === id
}

/** Test seam: number of currently open layers. */
export function openLayerCount(): number {
    return stack.length
}
