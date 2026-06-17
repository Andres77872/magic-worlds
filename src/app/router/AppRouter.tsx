/**
 * Application routing logic
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigation, useData, useAuth } from '../hooks'
import { Sidebar } from '../../ui/components/Sidebar'
import { MobileTopBar } from '../../ui/components/MobileTopBar'
import { SidebarNavDrawer } from '../../ui/components/SidebarNavDrawer'
import { LoginModal } from '../../ui/components/LoginModal'
import { AppWarningModal } from '../../ui/components/AppWarningModal'
import { CookieConsentBanner } from '../../ui/components/CookieConsentBanner'
import { ServicesDownBanner } from '../../ui/components/ServicesDownBanner'
import { SidebarTasksMenu, TasksDrawer } from '../../features/tasks'
import { CardPreviewModal, useCardPreviewModal } from '../../features/cards'
import { LoadingSpinner } from '../../ui/components/LoadingSpinner'
import { PlaylistDock } from '../../ui/components/audio/PlaylistDock'
import { GlowBackdrop } from '../../ui/primitives'
import { ErrorBoundary } from '../ErrorBoundary'

// Routes are code-split: each is its own chunk, loaded on demand. Import the LEAF
// module (not the feature barrel) so a heavy sibling (e.g. NovelStudio's TipTap)
// is never co-bundled with a light one (NovelGalleryPage). Named exports → default.
const LandingPage = lazy(() => import('../../features/landing/components/LandingPage').then(m => ({ default: m.LandingPage })))
const CharacterCreator = lazy(() => import('../../features/creation/character/components/CharacterCreator').then(m => ({ default: m.CharacterCreator })))
const WorldCreator = lazy(() => import('../../features/creation/world/components/WorldCreator').then(m => ({ default: m.WorldCreator })))
const ItemCreator = lazy(() => import('../../features/creation/item/components/ItemCreator').then(m => ({ default: m.ItemCreator })))
const AdventureCreator = lazy(() => import('../../features/creation/adventure/components/AdventureCreator').then(m => ({ default: m.AdventureCreator })))
const AdventureInteraction = lazy(() => import('../../features/interaction/components/AdventureInteraction').then(m => ({ default: m.AdventureInteraction })))
const ActiveAdventuresPage = lazy(() => import('../../features/interaction/components/ActiveAdventuresPage').then(m => ({ default: m.ActiveAdventuresPage })))
const CharacterChat = lazy(() => import('../../features/characterChat/components/CharacterChat').then(m => ({ default: m.CharacterChat })))
const ChatroomPage = lazy(() => import('../../features/characterChat/components/ChatroomPage').then(m => ({ default: m.ChatroomPage })))
const CallsPage = lazy(() => import('../../features/call/components/CallsPage').then(m => ({ default: m.CallsPage })))
const GalleryPage = lazy(() => import('../../features/gallery/components/GalleryPage').then(m => ({ default: m.GalleryPage })))
const CommunityGalleryPage = lazy(() => import('../../features/gallery/components/CommunityGalleryPage').then(m => ({ default: m.CommunityGalleryPage })))
const SharedCardPage = lazy(() => import('../../features/gallery/components/SharedCardPage').then(m => ({ default: m.SharedCardPage })))
const MediaGalleryPage = lazy(() => import('../../features/gallery/media/components/MediaGalleryPage').then(m => ({ default: m.MediaGalleryPage })))
const LorebookGalleryPage = lazy(() => import('../../features/lorebook/components/LorebookGalleryPage').then(m => ({ default: m.LorebookGalleryPage })))
const LorebookStudio = lazy(() => import('../../features/lorebook/components/LorebookStudio').then(m => ({ default: m.LorebookStudio })))
const NovelGalleryPage = lazy(() => import('../../features/novel/components/NovelGalleryPage').then(m => ({ default: m.NovelGalleryPage })))
const NovelStudio = lazy(() => import('../../features/novel/components/NovelStudio').then(m => ({ default: m.NovelStudio })))
const ProfilePage = lazy(() => import('../../features/profile/components/ProfilePage').then(m => ({ default: m.ProfilePage })))
const PasswordResetPage = lazy(() => import('../../features/auth/PasswordResetPage').then(m => ({ default: m.PasswordResetPage })))
const EmailVerifyPage = lazy(() => import('../../features/auth/EmailVerifyPage').then(m => ({ default: m.EmailVerifyPage })))
const GoogleCallbackPage = lazy(() => import('../../features/auth/GoogleCallbackPage').then(m => ({ default: m.GoogleCallbackPage })))
const DocsPage = lazy(() => import('../../features/docs/components/DocsPage').then(m => ({ default: m.DocsPage })))
const LegalPage = lazy(() => import('../../features/legal/components/LegalPage').then(m => ({ default: m.LegalPage })))
const AdminVoicesPage = lazy(() => import('../../features/admin/voices/components/AdminVoicesPage').then(m => ({ default: m.AdminVoicesPage })))
const VoiceStudioPage = lazy(() => import('../../features/voices/components/VoiceStudioPage').then(m => ({ default: m.VoiceStudioPage })))
const AdminAgentsPage = lazy(() => import('../../features/admin/agents/components/AdminAgentsPage').then(m => ({ default: m.AdminAgentsPage })))

export function AppRouter() {
    const { currentPage } = useNavigation()
    const { loadingState } = useData()
    const { isLoginModalOpen, closeLoginModal } = useAuth()
    const cardPreview = useCardPreviewModal()
    const mainRef = useRef<HTMLElement>(null)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
            <Sidebar
                className="hidden lg:flex"
                renderTasks={({ collapsed }) => <SidebarTasksMenu collapsed={collapsed} />}
            />
            <main ref={mainRef} data-app-main className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
                <MobileTopBar onOpenNav={() => setMobileNavOpen(true)} />
                <ServicesDownBanner />
                {loadingState.isLoading ? (
                    <div className="flex min-h-full flex-1 items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    // Keyed on the page so a crash resets when the user navigates
                    // away; scoped to <main> so the sidebar/nav/modals survive it.
                    <ErrorBoundary scope="page" inline key={currentPage}>
                      <Suspense fallback={<div className="flex min-h-full flex-1 items-center justify-center"><LoadingSpinner /></div>}>
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
                      </Suspense>
                    </ErrorBoundary>
                )}
            </main>

            <SidebarNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

            {/* Global Login Modal */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={closeLoginModal}
            />
            <AppWarningModal />
            <CookieConsentBanner />
            <TasksDrawer />
            <PlaylistDock onOpenCard={cardPreview.openCardPreview} />
            <CardPreviewModal
                target={cardPreview.target}
                card={cardPreview.card}
                loading={cardPreview.loading}
                error={cardPreview.error}
                onClose={cardPreview.closeCardPreview}
                showUsage
            />
        </div>
    )
}
