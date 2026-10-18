import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * Application routing logic
 */

import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { useNavigation, useData, useAuth, useWorkspace } from '../hooks'
import { NavigationCoordinatorContext } from '../providers/NavigationProvider'
import { Sidebar } from '../../ui/components/Sidebar'
import { MobileTopBar } from '../../ui/components/MobileTopBar'
import { SidebarNavDrawer } from '../../ui/components/SidebarNavDrawer'
import { LoginModal } from '../../ui/components/LoginModal'
import { AppWarningModal } from '../../ui/components/AppWarningModal'
import { CookieConsentBanner } from '../../ui/components/CookieConsentBanner'
import { ServicesDownBanner } from '../../ui/components/ServicesDownBanner'
import { AppUpdateBanner } from '../../ui/components/AppUpdateBanner'
import { DataLoadErrorBanner } from '../../ui/components/DataLoadErrorBanner'
import { SidebarTasksMenu, TasksDrawer } from '../../features/tasks'
import { CardPreviewModal, useCardPreviewModal } from '../../features/cards'
import { FloatingWindowsLayer } from '../../features/floatingWindows'
import { LoadingSpinner } from '../../ui/components/LoadingSpinner'
import { PlaylistDock } from '../../ui/components/audio/PlaylistDock'
import { GlowBackdrop, cx } from '../../ui/primitives'
import { ErrorBoundary } from '../ErrorBoundary'
import { isPageFeatureEnabled } from '../../shared/featureFlags'
import { FeatureAccessGate } from '@/features/errorPages/components/FeatureAccessGate'
import { WorkspaceNavigationBridge } from '../../features/workspaces/WorkspaceNavigationBridge'
import {
    ArchivedWorkspaceBanner,
    WorkspaceSwitchFailureNotice,
    WorkspaceUnavailableTarget,
} from '../../features/workspaces/components/WorkspaceNotices'
import { StoryReauthenticationGate } from './StoryReauthenticationGate'
import { LinkedEditorGate } from './LinkedEditorGate'
import { pageNeedsWorkspace } from './pageAccess'
import {
    WorkspaceStaleDialog,
    WorkspaceStaleNotice,
    WorkspaceUnavailableGate,
} from './WorkspaceGate'

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
const NotificationsPage = lazy(() => import('../../features/notifications/components/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const CharacterChat = lazy(() => import('../../features/characterChat/components/CharacterChat').then(m => ({ default: m.CharacterChat })))
const ChatroomPage = lazy(() => import('../../features/characterChat/components/ChatroomPage').then(m => ({ default: m.ChatroomPage })))
const CallsPage = lazy(() => import('../../features/call/components/CallsPage').then(m => ({ default: m.CallsPage })))
const LibraryPage = lazy(() => import('../../features/library/components/LibraryPage').then(m => ({ default: m.LibraryPage })))
const GalleryPage = lazy(() => import('../../features/gallery/components/GalleryPage').then(m => ({ default: m.GalleryPage })))
const CommunityGalleryPage = lazy(() => import('../../features/gallery/components/CommunityGalleryPage').then(m => ({ default: m.CommunityGalleryPage })))
const AppAssistantPage = lazy(() => import('../../features/appAssistant/components/AppAssistantPage').then(m => ({ default: m.AppAssistantPage })))
const SharedCardPage = lazy(() => import('../../features/gallery/components/SharedCardPage').then(m => ({ default: m.SharedCardPage })))
const MediaGalleryPage = lazy(() => import('../../features/gallery/media/components/MediaGalleryPage').then(m => ({ default: m.MediaGalleryPage })))
const LorebookGalleryPage = lazy(() => import('../../features/lorebook/components/LorebookGalleryPage').then(m => ({ default: m.LorebookGalleryPage })))
const LorebookResourcesGalleryPage = lazy(() => import('../../features/lorebook/components/LorebookResourcesGalleryPage').then(m => ({ default: m.LorebookResourcesGalleryPage })))
const LorebookStudio = lazy(() => import('../../features/lorebook/components/LorebookStudio').then(m => ({ default: m.LorebookStudio })))
const NovelGalleryPage = lazy(() => import('../../features/novel/components/NovelGalleryPage').then(m => ({ default: m.NovelGalleryPage })))
const NovelStudio = lazy(() => import('../../features/novel/components/NovelStudio').then(m => ({ default: m.NovelStudio })))
const NovelDeviceLibrary = lazy(() => import('../../features/novel/components/NovelDeviceLibrary').then(m => ({ default: m.NovelDeviceLibrary })))
const ProfilePage = lazy(() => import('../../features/profile/components/ProfilePage').then(m => ({ default: m.ProfilePage })))
const LlmProfilesPage = lazy(() => import('../../features/llmProfiles/LlmProfilesPage').then(m => ({ default: m.LlmProfilesPage })))
const AdminLlmProfilesPage = lazy(() => import('../../features/llmProfiles/LlmProfilesPage').then(m => ({ default: m.AdminLlmProfilesPage })))
const ImageProfilesPage = lazy(() => import('../../features/imageProfiles/ImageProfilesPage').then(m => ({ default: m.ImageProfilesPage })))
const AdminImageProfilesPage = lazy(() => import('../../features/imageProfiles/ImageProfilesPage').then(m => ({ default: m.AdminImageProfilesPage })))
const BillingPage = lazy(() => import('../../features/billing/components/BillingPage').then(m => ({ default: m.BillingPage })))
const PasswordResetPage = lazy(() => import('../../features/auth/PasswordResetPage').then(m => ({ default: m.PasswordResetPage })))
const EmailVerifyPage = lazy(() => import('../../features/auth/EmailVerifyPage').then(m => ({ default: m.EmailVerifyPage })))
const GoogleCallbackPage = lazy(() => import('../../features/auth/GoogleCallbackPage').then(m => ({ default: m.GoogleCallbackPage })))
const DocsPage = lazy(() => import('../../features/docs/components/DocsPage').then(m => ({ default: m.DocsPage })))
const LegalPage = lazy(() => import('../../features/legal/components/LegalPage').then(m => ({ default: m.LegalPage })))
const AdminVoicesPage = lazy(() => import('../../features/admin/voices/components/AdminVoicesPage').then(m => ({ default: m.AdminVoicesPage })))
const VoiceStudioPage = lazy(() => import('../../features/voices/components/VoiceStudioPage').then(m => ({ default: m.VoiceStudioPage })))
const AdminAgentsPage = lazy(() => import('../../features/admin/agents/components/AdminAgentsPage').then(m => ({ default: m.AdminAgentsPage })))
const AdminCreditCodesPage = lazy(() => import('../../features/admin/creditCodes/components/AdminCreditCodesPage').then(m => ({ default: m.AdminCreditCodesPage })))
const AdminMembershipPage = lazy(() => import('../../features/admin/membership/components/AdminMembershipPage').then(m => ({ default: m.AdminMembershipPage })))
const NotFoundPage = lazy(() => import('../../features/errorPages/components/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

export function AppRouter() {
    useFeatureFlags()
    const { currentPage, setPage } = useNavigation()
    const { loadingState } = useData()
    const {
        isLoginModalOpen,
        closeLoginModal,
        openLoginModal,
        continueSignedOut,
        sessionPhase,
        authEpoch,
        accountKey,
        isAuthenticated,
    } = useAuth()
    const workspace = useWorkspace()
    // The switch coordinator (absent outside NavigationProvider, e.g. isolated tests).
    const coordinator = useContext(NavigationCoordinatorContext)
    const cardPreview = useCardPreviewModal()
    const mainRef = useRef<HTMLElement>(null)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const pageEnabled = isPageFeatureEnabled(currentPage)

    // Workspace R1 (document 08): private pages wait for the handshake and show
    // explicit unavailable/stale states; public and account pages never wait.
    const needsWorkspace = pageEnabled && pageNeedsWorkspace(currentPage, isAuthenticated)
    // Verification consumes a single-use token and then signs out. Keep its result
    // mounted through that auth transition instead of reopening a tokenless page.
    // A committed workspace switch remounts private pages: no state crosses workspaces.
    const pageKey = currentPage === 'verify-email'
        ? currentPage
        : `${currentPage}:${currentPage === 'story' ? accountKey : authEpoch}${needsWorkspace ? `:${workspace.workspaceEpoch ?? 0}` : ''}`

    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }, [currentPage])

    const workspaceStale = workspace.status === 'stale'
    const workspaceBlocked = workspaceStale || workspace.status === 'unavailable'
    const [staleDialogDismissed, setStaleDialogDismissed] = useState(false)
    const reloadPage = () => window.location.reload()
    const workspaceGate: 'loading' | 'unavailable' | 'stale' | null = !needsWorkspace
        ? null
        : workspace.status === 'unavailable'
            ? 'unavailable'
            : workspaceStale && !workspace.selectedWorkspaceId
                ? 'stale'
                : workspace.status === 'idle' || workspace.status === 'loading'
                    ? 'loading'
                    : null
    // The library spinner belongs to pages that show library data.
    const showDataSpinner = loadingState.isLoading && (needsWorkspace || !isAuthenticated)
    // A URL naming content in another workspace is verified before the page loads.
    const routeStatus = needsWorkspace && workspaceGate === null ? coordinator?.routeStatus ?? 'ready' : 'ready'
    const switchFailure = coordinator?.switchFailure ?? null

    return (
        // `isolate` makes this div a stacking context so the -z-10 ambience
        // paints above bg-ink-800 yet below all content (sidebar included —
        // its translucent bg-ink-900/80 lets the glow continue underneath).
        <div className="isolate flex min-h-dvh bg-ink-800 text-parchment-50">
            {/* Viewport-fixed app background: static stone grain underneath,
                breathing candlelight on top. Stays put while <main> scrolls, so
                it never crops at a section edge. */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <div className="app-stone absolute inset-0" />
                <GlowBackdrop variant="page" />
            </div>
            <Sidebar
                className="hidden lg:flex"
                renderTasks={({ collapsed }) => <SidebarTasksMenu collapsed={collapsed} />}
            />
            {/* `relative`: <main> is the scroller, so it must also be the containing
                block — an absolute descendant with no positioned ancestor (an
                `sr-only` label) would otherwise anchor to the document, escape
                this scroll and give the whole page a second scrollbar. */}
            <main ref={mainRef} data-app-main className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-y-auto">
                <MobileTopBar onOpenNav={() => setMobileNavOpen(true)} />
                <ServicesDownBanner />
                {/* A stale build keeps the update banner up even after "Not now". */}
                <AppUpdateBanner updateAvailable={workspaceStale ? true : undefined} />
                {/* Blocking workspace states replace the data-load banner (document 08). */}
                {!workspaceBlocked && <DataLoadErrorBanner />}
                {switchFailure && coordinator && (
                    <WorkspaceSwitchFailureNotice
                        failure={switchFailure}
                        sourceName={workspace.selectedWorkspace?.name ?? ''}
                        onDismiss={coordinator.dismissSwitchFailure}
                    />
                )}
                {needsWorkspace && workspaceGate === null && routeStatus === 'ready' && <ArchivedWorkspaceBanner />}
                {isAuthenticated && isPageFeatureEnabled('story') && ['library', 'gallery-stories', 'story'].includes(currentPage) && <Suspense fallback={null}>
                    <NovelDeviceLibrary key={accountKey} showEntry={currentPage !== 'story' || workspaceGate !== null} />
                </Suspense>}
                {workspaceGate === 'unavailable' ? (
                    <WorkspaceUnavailableGate onRetry={workspace.refreshWorkspaces} />
                ) : workspaceGate === 'stale' ? (
                    <WorkspaceStaleNotice onReload={reloadPage} />
                ) : routeStatus === 'unavailable' ? (
                    <WorkspaceUnavailableTarget
                        showLibrary
                        onLibrary={() => setPage('library')}
                        onHome={() => setPage('landing')}
                    />
                ) : workspaceGate === 'loading' || routeStatus === 'resolving' || showDataSpinner ? (
                    <div className="flex min-h-full flex-1 items-center justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    // Keyed on the page so a crash resets when the user navigates
                    // away; scoped to <main> so the sidebar/nav/modals survive it.
                    <ErrorBoundary scope="page" inline key={pageKey}>
                        <Suspense fallback={<div className="flex min-h-full flex-1 items-center justify-center"><LoadingSpinner /></div>}>
                            {!pageEnabled ? (
                                <FeatureAccessGate />
                            ) : (
                                <>
                                    {currentPage === 'landing' && <LandingPage />}
                                    {currentPage === 'library' && <LibraryPage />}
                                    {currentPage === 'gallery-characters' && <GalleryPage type="character" />}
                                    {currentPage === 'gallery-personas' && <GalleryPage type="persona" />}
                                    {currentPage === 'gallery-worlds' && <GalleryPage type="world" />}
                                    {currentPage === 'gallery-items' && <GalleryPage type="item" />}
                                    {currentPage === 'gallery-adventures' && <GalleryPage type="adventure" />}
                                    {currentPage === 'gallery-lorebooks' && <LorebookGalleryPage />}
                                    {currentPage === 'gallery-resources' && <LorebookResourcesGalleryPage />}
                                    {currentPage === 'gallery-stories' && <NovelGalleryPage />}
                                    {currentPage === 'gallery-media' && <MediaGalleryPage />}
                                    {currentPage === 'community' && <CommunityGalleryPage />}
                                    {currentPage === 'assistant' && <AppAssistantPage />}
                                    {currentPage === 'shared-card' && <SharedCardPage />}
                                    {currentPage === 'character' && <CharacterCreator />}
                                    {currentPage === 'world' && <WorldCreator />}
                                    {currentPage === 'item' && <ItemCreator />}
                                    {currentPage === 'adventure' && <LinkedEditorGate page="adventure"><AdventureCreator /></LinkedEditorGate>}
                                    {currentPage === 'lorebook' && <LinkedEditorGate page="lorebook"><LorebookStudio /></LinkedEditorGate>}
                                    {currentPage === 'story' && (
                                        // Every wrapper must propagate the stretched height: the
                                        // studio fills the viewport via flex, and an auto-height
                                        // div here would collapse it to its min content height.
                                        <div className="relative flex min-h-full flex-1 flex-col">
                                            <div
                                                key={accountKey}
                                                inert={sessionPhase === 'expired'}
                                                aria-hidden={sessionPhase === 'expired' || undefined}
                                                className={cx(
                                                    'flex min-h-0 flex-1 flex-col',
                                                    sessionPhase === 'expired' && 'invisible pointer-events-none select-none',
                                                )}
                                            >
                                                <LinkedEditorGate page="story"><NovelStudio /></LinkedEditorGate>
                                            </div>
                                            {sessionPhase === 'expired' && (
                                                <StoryReauthenticationGate
                                                    onLogin={openLoginModal}
                                                    onContinueSignedOut={() => {
                                                        continueSignedOut()
                                                        setPage('landing')
                                                    }}
                                                />
                                            )}
                                        </div>
                                    )}
                                    {currentPage === 'active-adventures' && <ActiveAdventuresPage />}
                                    {currentPage === 'notifications' && <NotificationsPage />}
                                    {currentPage === 'interaction' && <AdventureInteraction />}
                                    {currentPage === 'character-chat' && <CharacterChat />}
                                    {currentPage === 'chatroom' && <ChatroomPage />}
                                    {currentPage === 'calls' && <CallsPage />}
                                    {currentPage === 'profile' && <ProfilePage />}
                                    {currentPage === 'llm-profiles' && <LlmProfilesPage key={accountKey} />}
                                    {currentPage === 'admin-llm-profiles' && <AdminLlmProfilesPage key={accountKey} />}
                                    {currentPage === 'image-profiles' && <ImageProfilesPage key={accountKey} />}
                                    {currentPage === 'admin-image-profiles' && <AdminImageProfilesPage key={accountKey} />}
                                    {currentPage === 'billing' && <BillingPage />}
                                    {currentPage === 'password-reset' && <PasswordResetPage />}
                                    {currentPage === 'verify-email' && <EmailVerifyPage />}
                                    {currentPage === 'google-callback' && <GoogleCallbackPage />}
                                    {currentPage === 'voice-studio' && <VoiceStudioPage />}
                                    {currentPage === 'admin-voices' && <AdminVoicesPage />}
                                    {currentPage === 'admin-agents' && <AdminAgentsPage />}
                                    {currentPage === 'admin-credit-codes' && <AdminCreditCodesPage />}
                                    {currentPage === 'admin-membership' && <AdminMembershipPage />}
                                    {currentPage === 'docs' && <DocsPage />}
                                    {currentPage === 'about' && <LegalPage page="about" />}
                                    {currentPage === 'contact' && <LegalPage page="contact" />}
                                    {currentPage === 'privacy' && <LegalPage page="privacy" />}
                                    {currentPage === 'disclaimer' && <LegalPage page="disclaimer" />}
                                    {currentPage === 'terms' && <LegalPage page="terms" />}
                                    {currentPage === 'not-found' && <NotFoundPage />}
                                </>
                            )}
                        </Suspense>
                    </ErrorBoundary>
                )}
            </main>

            <SidebarNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
            {/* Origin links, creator returns and creation-origin cleanup for the switch coordinator. */}
            <WorkspaceNavigationBridge />

            {/* Global Login Modal */}
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={closeLoginModal}
            />
            <AppWarningModal />
            <WorkspaceStaleDialog
                open={workspaceStale && needsWorkspace && workspace.selectedWorkspaceId !== null && !staleDialogDismissed}
                onReload={reloadPage}
                onDismiss={() => setStaleDialogDismissed(true)}
            />
            <CookieConsentBanner />
            <div key={`private-overlays:${authEpoch}`}>
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
                <FloatingWindowsLayer />
            </div>
        </div>
    )
}
