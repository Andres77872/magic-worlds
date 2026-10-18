import { useSyncExternalStore } from 'react'

/** A browser offline signal is a stop condition, never a server-health promise. */
export function browserCanConnect(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine !== false
}
function subscribe(listener: () => void) {
    window.addEventListener('online', listener)
    window.addEventListener('offline', listener)
    return () => {
        window.removeEventListener('online', listener)
        window.removeEventListener('offline', listener)
    }
}
export function useBrowserConnectivity(): boolean {
    return useSyncExternalStore(subscribe, browserCanConnect, () => true)
}
