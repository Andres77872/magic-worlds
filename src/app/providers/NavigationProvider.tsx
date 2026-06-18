/**
 * Navigation state management provider
 */

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PageType, NavigationState } from '../../shared'
import { pageFromHash, pageHash, parseCardEditHash, parseResourceEditHash, type CardEditHashTarget, type ResourceEditHashTarget } from '../../features/gallery/galleryLinks'

interface NavigationContextValue extends NavigationState {
    setPage: (page: PageType, opts?: { hash?: string }) => void
    goBack: (fallback?: PageType) => void
    /** Parsed card-editor deep-link params (`?card=&version=`) for the current hash, or null. */
    cardEdit: CardEditHashTarget | null
    /** Parsed resource deep-link params (`?resource=&type=`) for the current hash, or null. */
    resourceEdit: ResourceEditHashTarget | null
    /** Rewrite the current page's hash in place (no history push) — e.g. to stamp a card id. */
    replaceHash: (hash: string) => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

interface NavigationProviderProps {
    children: ReactNode
}

interface NavigationEntry {
    page: PageType
    hash: string
}

// Pure helpers (no component state) — module-scoped so setPage/goBack can be
// stable useCallback([]) refs without re-creating these each render.
const hashForPage = (page: PageType, hash?: string): string => {
    if (hash) return hash
    if (typeof window === 'undefined') return pageHash(page)
    const currentHash = window.location.hash
    return currentHash && pageFromHash(currentHash) === page ? currentHash : pageHash(page)
}

const writeHash = (page: PageType, replace = false, hash?: string) => {
    if (typeof window === 'undefined') return
    const nextHash = hash ?? pageHash(page)
    if (window.location.hash === nextHash) return
    try {
        if (replace) window.history.replaceState(null, '', nextHash)
        else window.history.pushState(null, '', nextHash)
    } catch {
        window.location.hash = nextHash
    }
}

const sameEntry = (a: NavigationEntry, b: NavigationEntry) => a.page === b.page && a.hash === b.hash

export function NavigationProvider({ children }: NavigationProviderProps) {
    // Unknown/broken hashes resolve to the 404 page (pageFromHash returns null only
    // for genuinely-unknown routes; empty/`#/` normalizes to landing inside it).
    const [currentPage, setCurrentPage] = useState<PageType>(() => pageFromHash() ?? 'not-found')
    const [backStack, setBackStack] = useState<NavigationEntry[]>([])
    // Mirror the live hash into state so card-editor params (`?card=&version=`) stay reactive
    // across setPage / goBack / hashchange / popstate.
    const [currentHash, setCurrentHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash))
    const currentPageRef = useRef(currentPage)
    const backStackRef = useRef(backStack)

    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    useEffect(() => {
        backStackRef.current = backStack
    }, [backStack])

    const setPage = useCallback((page: PageType, opts?: { hash?: string }) => {
        const currentEntry = { page: currentPageRef.current, hash: hashForPage(currentPageRef.current) }
        const nextEntry = { page, hash: hashForPage(page, opts?.hash) }
        if (!sameEntry(currentEntry, nextEntry)) {
            setBackStack((stack) => [...stack, currentEntry])
        }
        setCurrentPage(page)
        writeHash(page, false, opts?.hash)
        setCurrentHash(nextEntry.hash)
    }, [])

    const goBack = useCallback((fallback: PageType = 'landing') => {
        const target = backStackRef.current[backStackRef.current.length - 1] ?? { page: fallback, hash: pageHash(fallback) }
        setBackStack((stack) => stack.slice(0, -1))
        setCurrentPage(target.page)
        writeHash(target.page, true, target.hash)
        setCurrentHash(target.hash)
    }, [])

    // Rewrite the active page's hash in place (replaceState) without a history push —
    // used to stamp the card id into the URL after a create→edit transition, etc.
    const replaceHash = useCallback((hash: string) => {
        writeHash(currentPageRef.current, true, hash)
        setCurrentHash(hash)
    }, [])

    useEffect(() => {
        if (!pageFromHash()) writeHash(currentPage, true)
        setCurrentHash(typeof window === 'undefined' ? '' : window.location.hash)
        const syncFromHash = () => {
            // A runtime hashchange to an unknown/broken link surfaces the 404 page
            // instead of silently ignoring the navigation.
            const page = pageFromHash() ?? 'not-found'
            const nextEntry = { page, hash: hashForPage(page) }
            const currentEntry = { page: currentPageRef.current, hash: hashForPage(currentPageRef.current) }
            if (!sameEntry(nextEntry, currentEntry)) {
                setBackStack((stack) => {
                    const top = stack[stack.length - 1]
                    if (top && sameEntry(top, nextEntry)) return stack.slice(0, -1)
                    return [...stack, currentEntry]
                })
            }
            setCurrentPage(page)
            setCurrentHash(window.location.hash)
        }
        window.addEventListener('hashchange', syncFromHash)
        window.addEventListener('popstate', syncFromHash)
        return () => {
            window.removeEventListener('hashchange', syncFromHash)
            window.removeEventListener('popstate', syncFromHash)
        }
        // Only install the URL listeners once; setPage/goBack own normal writes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const cardEdit = useMemo(() => parseCardEditHash(currentHash), [currentHash])
    const resourceEdit = useMemo(() => parseResourceEditHash(currentHash), [currentHash])

    const value: NavigationContextValue = useMemo(() => ({
        currentPage,
        previousPage: backStack[backStack.length - 1]?.page,
        setPage,
        goBack,
        cardEdit,
        resourceEdit,
        replaceHash,
    }), [currentPage, backStack, setPage, goBack, cardEdit, resourceEdit, replaceHash])

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    )
}

// Export the context for use in hooks
export { NavigationContext }
