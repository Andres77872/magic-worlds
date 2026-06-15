/**
 * Navigation state management provider
 */

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PageType, NavigationState } from '../../shared'
import { pageFromHash, pageHash } from '../../features/gallery/galleryLinks'

interface NavigationContextValue extends NavigationState {
    setPage: (page: PageType, opts?: { hash?: string }) => void
    goBack: (fallback?: PageType) => void
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
    const [currentPage, setCurrentPage] = useState<PageType>(() => pageFromHash() ?? 'landing')
    const [backStack, setBackStack] = useState<NavigationEntry[]>([])
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
    }, [])

    const goBack = useCallback((fallback: PageType = 'landing') => {
        const target = backStackRef.current[backStackRef.current.length - 1] ?? { page: fallback, hash: pageHash(fallback) }
        setBackStack((stack) => stack.slice(0, -1))
        setCurrentPage(target.page)
        writeHash(target.page, true, target.hash)
    }, [])

    useEffect(() => {
        if (!pageFromHash()) writeHash(currentPage, true)
        const syncFromHash = () => {
            const page = pageFromHash()
            if (!page) return
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

    const value: NavigationContextValue = useMemo(() => ({
        currentPage,
        previousPage: backStack[backStack.length - 1]?.page,
        setPage,
        goBack,
    }), [currentPage, backStack, setPage, goBack])

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    )
}

// Export the context for use in hooks
export { NavigationContext }
