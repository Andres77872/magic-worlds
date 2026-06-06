/**
 * Application routing logic
 */

import { useNavigation, useData, useAuth } from '../hooks'
import { Sidebar } from '../../ui/components/Sidebar'
import { LoginModal } from '../../ui/components/LoginModal'
import { LandingPage } from '../../features/landing/components/LandingPage'
import { CharacterCreator } from '../../features/creation/character/components/CharacterCreator'
import { WorldCreator } from '../../features/creation/world/components/WorldCreator'
import { AdventureCreator } from '../../features/creation/adventure/components/AdventureCreator'
import { AdventureInteraction } from '../../features/interaction/components/AdventureInteraction'
import { LoadingSpinner } from '../../ui/components/LoadingSpinner'

export function AppRouter() {
    const { currentPage } = useNavigation()
    const { loadingState } = useData()
    const { isLoginModalOpen, closeLoginModal } = useAuth()

    if (loadingState.isLoading) {
        return <LoadingSpinner />
    }

    // Log data loading errors to console for debugging but do NOT block the UI
    // The landing page handles empty/missing data gracefully
    if (loadingState.error) {
        console.error('[AppRouter] Data loading error (non-blocking):', loadingState.error)
    }

    return (
        <div className="flex min-h-screen bg-ink-800 text-parchment-50">
            <Sidebar />
            <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
                {currentPage === 'landing' && <LandingPage />}
                {currentPage === 'character' && <CharacterCreator />}
                {currentPage === 'world' && <WorldCreator />}
                {currentPage === 'adventure' && <AdventureCreator />}
                {currentPage === 'interaction' && <AdventureInteraction />}
            </main>

            {/* Global Login Modal */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={closeLoginModal}
            />
        </div>
    )
}
