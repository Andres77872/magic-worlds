/**
 * Application routing logic
 */

import { useNavigation, useData, useTheme, useAuth } from '../hooks'
import { Header } from '../../ui/components/Header'
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
    const { theme } = useTheme()
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
        <div className={`app ${theme}`}>
            <Header />
            <main className="main-content">
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
