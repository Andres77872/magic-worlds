import { useCallback, useSyncExternalStore } from 'react'

function matchMediaSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * Built on `useSyncExternalStore` so the first render is already correct (no
 * layout flash) and there's no effect-driven setState. SSR-safe: the server
 * snapshot is `false`.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (!matchMediaSupported()) return () => {}
            const mql = window.matchMedia(query)
            mql.addEventListener('change', onChange)
            return () => mql.removeEventListener('change', onChange)
        },
        [query],
    )
    const getSnapshot = () => (matchMediaSupported() ? window.matchMedia(query).matches : false)
    return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** True at Tailwind's `lg` breakpoint (≥1024px) — the docked-layout cutover. */
export function useIsDesktop(): boolean {
    return useMediaQuery('(min-width: 1024px)')
}
