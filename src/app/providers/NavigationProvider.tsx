/**
 * Navigation state management provider
 */

import { createContext, useState, type ReactNode } from 'react'
import type { PageType, NavigationState } from '../../shared'

interface NavigationContextValue extends NavigationState {
    setPage: (page: PageType) => void
    goBack: () => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

interface NavigationProviderProps {
    children: ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
    const [currentPage, setCurrentPage] = useState<PageType>('landing')
    const [previousPage, setPreviousPage] = useState<PageType | undefined>(undefined)

    const setPage = (page: PageType) => {
        setPreviousPage(currentPage)
        setCurrentPage(page)
    }

    const goBack = () => {
        if (previousPage) {
            setCurrentPage(previousPage)
            setPreviousPage(undefined)
        }
    }

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
