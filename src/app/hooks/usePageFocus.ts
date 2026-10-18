import { useSyncExternalStore } from 'react'

/** The tab is showing, focused or not (a window beside the one in use still counts). */
export function isPageVisible(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'visible'
}

/** A visible tab can still belong to an unfocused browser window. */
export function isPageFocused(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()
}

function subscribeToPageFocus(onChange: () => void): () => void {
    window.addEventListener('focus', onChange)
    window.addEventListener('blur', onChange)
    document.addEventListener('visibilitychange', onChange)

    return () => {
        window.removeEventListener('focus', onChange)
        window.removeEventListener('blur', onChange)
        document.removeEventListener('visibilitychange', onChange)
    }
}

/** Pauses automatic work when this page is hidden or the browser loses focus. */
export function usePageFocus(): boolean {
    return useSyncExternalStore(subscribeToPageFocus, isPageFocused, () => false)
}

function subscribeToPageVisibility(onChange: () => void): () => void {
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
}

/** Pauses automatic work only while this page is hidden; an unfocused but visible window keeps it running. */
export function usePageVisible(): boolean {
    return useSyncExternalStore(subscribeToPageVisibility, isPageVisible, () => false)
}
