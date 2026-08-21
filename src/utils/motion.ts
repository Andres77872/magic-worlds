/**
 * Motion preferences for JavaScript-driven movement.
 *
 * `theme.css` collapses every CSS animation and transition under
 * `prefers-reduced-motion: reduce`, but that rule cannot reach a JS
 * `ScrollBehavior` — a `scrollIntoView({ behavior: 'smooth' })` keeps animating
 * for a reader who asked the system for no motion. Route those calls through
 * `scrollBehavior()` instead of hardcoding `'smooth'`.
 */

/** True when the reader has asked the OS to minimise animation. */
export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** `'smooth'` normally, `'auto'` (instant) under reduced motion. */
export function scrollBehavior(): ScrollBehavior {
    return prefersReducedMotion() ? 'auto' : 'smooth'
}
