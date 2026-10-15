/**
 * Scrolling for the Docs page. The app scrolls inside `[data-app-main]`, not
 * the window, so targets are measured against that container and honour each
 * target's `scroll-margin-top`. Motion follows the reduced-motion preference.
 */
import { scrollBehavior } from '@/utils/motion'

export function scrollDocsTargetIntoView(id: string) {
    const target = document.getElementById(id)
    if (!target) return

    const behavior = scrollBehavior()
    const scroller = document.querySelector<HTMLElement>('[data-app-main]')
    if (!scroller) {
        target.scrollIntoView?.({ behavior, block: 'start' })
        return
    }

    const scrollerRect = scroller.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0
    const top = scroller.scrollTop + targetRect.top - scrollerRect.top - scrollMarginTop

    scroller.scrollTo({ top: Math.max(0, top), left: 0, behavior })
}

/** Move keyboard focus to a target's heading (`<id>-title`, `tabIndex=-1`) without a second scroll. */
export function focusDocsTarget(id: string) {
    document.getElementById(`${id}-title`)?.focus({ preventScroll: true })
}

/** True when `id` sits above the visible part of the docs scroller. */
export function isAboveViewport(id: string): boolean {
    const target = document.getElementById(id)
    if (!target) return false
    const scroller = document.querySelector<HTMLElement>('[data-app-main]')
    const top = scroller ? scroller.getBoundingClientRect().top : 0
    return target.getBoundingClientRect().top < top
}
