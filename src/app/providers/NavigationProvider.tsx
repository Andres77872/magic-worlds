/**
 * Navigation state management provider
 */

import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { PageType, NavigationState } from '../../shared'
import { pageFromHash, pageHash } from '../../features/gallery/galleryLinks'

interface NavigationContextValue extends NavigationState {
    setPage: (page: PageType) => void
    goBack: () => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

interface NavigationProviderProps {
    children: ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
    const [currentPage, setCurrentPage] = useState<PageType>(() => pageFromHash() ?? 'landing')
    const [previousPage, setPreviousPage] = useState<PageType | undefined>(undefined)
    const currentPageRef = useRef(currentPage)

    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    const writeHash = (page: PageType, replace = false) => {
        if (typeof window === 'undefined') return
        const nextHash = pageHash(page)
        if (window.location.hash === nextHash) return
        try {
            if (replace) window.history.replaceState(null, '', nextHash)
            else window.history.pushState(null, '', nextHash)
        } catch {
            window.location.hash = nextHash
        }
    }

    const setPage = (page: PageType) => {
        setPreviousPage(currentPage)
        setCurrentPage(page)
        writeHash(page)
    }

    const goBack = () => {
        if (previousPage) {
            setCurrentPage(previousPage)
            setPreviousPage(undefined)
            writeHash(previousPage)
        }
    }

    useEffect(() => {
        if (!pageFromHash()) writeHash(currentPage, true)
        const syncFromHash = () => {
            const page = pageFromHash()
            if (!page) return
            setPreviousPage((prev) => (page === currentPageRef.current ? prev : currentPageRef.current))
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

    const value: NavigationContextValue = {
        currentPage,
        previousPage,
        setPage,
        goBack
    }

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    )
}

// Export the context for use in hooks
export { NavigationContext }
