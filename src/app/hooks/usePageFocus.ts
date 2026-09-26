import { useSyncExternalStore } from 'react'

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
