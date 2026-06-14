/**
 * Application routing logic
 */

import { useEffect, useRef } from 'react'
import { useNavigation, useData, useAuth } from '../hooks'
import { Sidebar } from '../../ui/components/Sidebar'
import { LoginModal } from '../../ui/components/LoginModal'
import { AppWarningModal } from '../../ui/components/AppWarningModal'
import { ServicesDownBanner } from '../../ui/components/ServicesDownBanner'
import { LandingPage } from '../../features/landing/components/LandingPage'
import { CharacterCreator } from '../../features/creation/character/components/CharacterCreator'
import { WorldCreator } from '../../features/creation/world/components/WorldCreator'
import { ItemCreator } from '../../features/creation/item/components/ItemCreator'
import { AdventureCreator } from '../../features/creation/adventure/components/AdventureCreator'
import { AdventureInteraction } from '../../features/interaction/components/AdventureInteraction'
import { ActiveAdventuresPage } from '../../features/interaction/components/ActiveAdventuresPage'
import { CharacterChat, ChatroomPage } from '../../features/characterChat/components'
import { CallsPage } from '../../features/call'
import { CommunityGalleryPage, GalleryPage, MediaGalleryPage, SharedCardPage } from '../../features/gallery'
import { LorebookGalleryPage, LorebookStudio } from '../../features/lorebook'
import { NovelGalleryPage, NovelStudio } from '../../features/novel'
import { ProfilePage } from '../../features/profile'
import { PasswordResetPage, EmailVerifyPage, GoogleCallbackPage } from '../../features/auth'
import { TasksDrawer } from '../../features/tasks'
import { DocsPage } from '../../features/docs'
import { LegalPage } from '../../features/legal'
import { AdminVoicesPage } from '../../features/admin/voices'
import { VoiceStudioPage } from '../../features/voices'
import { AdminAgentsPage } from '../../features/admin/agents'
import { CardPreviewModal, useCardPreviewModal } from '../../features/cards'
import { LoadingSpinner } from '../../ui/components/LoadingSpinner'
import { PlaylistDock } from '../../ui/components/audio/PlaylistDock'
import { GlowBackdrop } from '../../ui/primitives'

export function AppRouter() {
    const { currentPage } = useNavigation()
    const { loadingState } = useData()
    const { isLoginModalOpen, closeLoginModal } = useAuth()
    const cardPreview = useCardPreviewModal()
    const mainRef = useRef<HTMLElement>(null)

    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }, [currentPage])

    // Data loading errors are non-blocking — the landing page handles empty/
    // missing data gracefully, and DataProvider already logged the underlying
    // error at the appropriate level. Keep this a quiet, non-alarming note.
    if (loadingState.error) {
        console.warn('[AppRouter] Data loading error (non-blocking):', loadingState.error)
    }

    return (
        // `isolate` makes this div a stacking context so the -z-10 ambience
        // paints above bg-ink-800 yet below all content (sidebar included —
        // its translucent bg-ink-900/80 lets the glow continue underneath).
        <div className="isolate flex min-h-screen bg-ink-800 text-parchment-50">
            {/* Viewport-fixed app background: static stone grain underneath,
                breathing candlelight on top. Stays put while <main> scrolls, so
                it never crops at a section edge. */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <div className="app-stone absolute inset-0" />
                <GlowBackdrop variant="page" animated />
            </div>
            <Sidebar />
            <main ref={mainRef} data-app-main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
                <ServicesDownBanner />
                {loadingState.isLoading ? (
                    <div className="flex min-h-full flex-1 items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {currentPage === 'landing' && <LandingPage />}
                        {currentPage === 'gallery-characters' && <GalleryPage type="character" />}
                        {currentPage === 'gallery-personas' && <GalleryPage type="persona" />}
                        {currentPage === 'gallery-worlds' && <GalleryPage type="world" />}
                        {currentPage === 'gallery-items' && <GalleryPage type="item" />}
                        {currentPage === 'gallery-adventures' && <GalleryPage type="adventure" />}
                        {currentPage === 'gallery-lorebooks' && <LorebookGalleryPage />}
                        {currentPage === 'gallery-stories' && <NovelGalleryPage />}
                        {currentPage === 'gallery-media' && <MediaGalleryPage />}
                        {currentPage === 'community' && <CommunityGalleryPage />}
                        {currentPage === 'shared-card' && <SharedCardPage />}
                        {currentPage === 'character' && <CharacterCreator />}
                        {currentPage === 'world' && <WorldCreator />}
                        {currentPage === 'item' && <ItemCreator />}
                        {currentPage === 'adventure' && <AdventureCreator />}
                        {currentPage === 'lorebook' && <LorebookStudio />}
                        {currentPage === 'story' && <NovelStudio />}
                        {currentPage === 'active-adventures' && <ActiveAdventuresPage />}
                        {currentPage === 'interaction' && <AdventureInteraction />}
                        {currentPage === 'character-chat' && <CharacterChat />}
                        {currentPage === 'chatroom' && <ChatroomPage />}
                        {currentPage === 'calls' && <CallsPage />}
                        {currentPage === 'profile' && <ProfilePage />}
                        {currentPage === 'password-reset' && <PasswordResetPage />}
                        {currentPage === 'verify-email' && <EmailVerifyPage />}
                        {currentPage === 'google-callback' && <GoogleCallbackPage />}
                        {currentPage === 'voice-studio' && <VoiceStudioPage />}
                        {currentPage === 'admin-voices' && <AdminVoicesPage />}
                        {currentPage === 'admin-agents' && <AdminAgentsPage />}
                        {currentPage === 'docs' && <DocsPage />}
                        {currentPage === 'about' && <LegalPage page="about" />}
                        {currentPage === 'contact' && <LegalPage page="contact" />}
                        {currentPage === 'privacy' && <LegalPage page="privacy" />}
                        {currentPage === 'disclaimer' && <LegalPage page="disclaimer" />}
                    </>
                )}
            </main>

            {/* Global Login Modal */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={closeLoginModal}
            />
            <AppWarningModal />
            <TasksDrawer />
            <PlaylistDock onOpenCard={cardPreview.openCardPreview} />
            <CardPreviewModal
                target={cardPreview.target}
                card={cardPreview.card}
                loading={cardPreview.loading}
                error={cardPreview.error}
                onClose={cardPreview.closeCardPreview}
            />
        </div>
    )
}
