/**
 * Where a hover card sits, in viewport (`position: fixed`) coordinates.
 *
 * A card for a link in the thread opens under the link and flips above it
 * when the viewport runs out. A card opened from a link inside another card
 * opens beside that card (right, else left) so the two stay readable side by
 * side — the Paradox-style nested stack — and falls back to under the link
 * when neither side has room.
 */

export interface PlacementRect {
    left: number
    top: number
    right: number
    bottom: number
}

export interface HoverCardPlacementInput {
    anchor: PlacementRect
    /** The card the anchor link sits in, for nested cards. */
    host: PlacementRect | null
    size: { width: number; height: number }
    viewport: { width: number; height: number }
}

const MARGIN = 8
const GAP = 6
const SIDE_GAP = 8
/** A nested card starts a little above its link so the link stays in view. */
const NESTED_LIFT = 14

export function placeHoverCard({ anchor, host, size, viewport }: HoverCardPlacementInput): { left: number; top: number } {
    const clampTop = (top: number) => Math.max(MARGIN, Math.min(top, viewport.height - size.height - MARGIN))
    const clampLeft = (left: number) => Math.max(MARGIN, Math.min(left, viewport.width - size.width - MARGIN))

    if (host) {
        const right = host.right + SIDE_GAP
        if (right + size.width <= viewport.width - MARGIN) return { left: right, top: clampTop(anchor.top - NESTED_LIFT) }
        const left = host.left - SIDE_GAP - size.width
        if (left >= MARGIN) return { left, top: clampTop(anchor.top - NESTED_LIFT) }
    }

    let top = anchor.bottom + GAP
    if (top + size.height > viewport.height - MARGIN) {
        const above = anchor.top - GAP - size.height
        top = above >= MARGIN ? above : viewport.height - MARGIN - size.height
    }
    return { left: clampLeft(anchor.left), top: clampTop(top) }
}
