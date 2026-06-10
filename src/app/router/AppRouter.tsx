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
import { CharacterChat } from '../../features/characterChat/components'
import { GalleryPage, MediaGalleryPage } from '../../features/gallery'
import { ProfilePage } from '../../features/profile'
import { LoadingSpinner } from '../../ui/components/LoadingSpinner'

export function AppRouter() {
    const { currentPage } = useNavigation()
    const { loadingState } = useData()
    const { isLoginModalOpen, closeLoginModal } = useAuth()

    if (loadingState.isLoading) {
        return <LoadingSpinner />
    }

    // Data loading errors are non-blocking — the landing page handles empty/
    // missing data gracefully, and DataProvider already logged the underlying
    // error at the appropriate level. Keep this a quiet, non-alarming note.
    if (loadingState.error) {
        console.warn('[AppRouter] Data loading error (non-blocking):', loadingState.error)
    }

    return (
        <div className="flex min-h-screen bg-ink-800 text-parchment-50">
            <Sidebar />
            <main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
                {currentPage === 'landing' && <LandingPage />}
                {currentPage === 'gallery-characters' && <GalleryPage type="character" />}
                {currentPage === 'gallery-worlds' && <GalleryPage type="world" />}
                {currentPage === 'gallery-adventures' && <GalleryPage type="adventure" />}
                {currentPage === 'gallery-media' && <MediaGalleryPage />}
                {currentPage === 'character' && <CharacterCreator />}
                {currentPage === 'world' && <WorldCreator />}
                {currentPage === 'adventure' && <AdventureCreator />}
                {currentPage === 'interaction' && <AdventureInteraction />}
                {currentPage === 'character-chat' && <CharacterChat />}
                {currentPage === 'profile' && <ProfilePage />}
            </main>

            {/* Global Login Modal */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={closeLoginModal}
            />
        </div>
    )
}
