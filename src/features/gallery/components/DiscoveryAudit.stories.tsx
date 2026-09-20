/** Deterministic route fixtures for the complete discovery/public-screen audit. */
import { useState, type ComponentProps, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fireEvent, within } from 'storybook/test'
import { i18n } from '@/app/i18n'
import { CookieConsentProvider } from '@/app/providers/CookieConsentProvider'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { apiService } from '@/infrastructure/api'
import { clearAuthDeepLink } from '@/app/bootstrap/authDeepLink'
import { characters, worlds, adventures, templates, characterChats } from '@/ui/components/lists/fixtures'
import { heroArt } from '@/assets/marketing'
import { LandingPage } from '@/features/landing/components/LandingPage'
import { DocsPage } from '@/features/docs/components/DocsPage'
import { LegalPage } from '@/features/legal/components/LegalPage'
import { PasswordResetPage } from '@/features/auth/PasswordResetPage'
import { EmailVerifyPage } from '@/features/auth/EmailVerifyPage'
import { GoogleCallbackPage } from '@/features/auth/GoogleCallbackPage'
import { NotFoundPage } from '@/features/errorPages/components/NotFoundPage'
import { GalleryPage } from './GalleryPage'
import { CommunityGalleryPage } from './CommunityGalleryPage'
import { SharedCardPage } from './SharedCardPage'
import { MediaGalleryPage } from '../media/components/MediaGalleryPage'
import { GALLERY_CONFIG, type GalleryType } from '../galleryConfig'
import { galleryItemToCardPreview } from '../galleryCardPreview'
import { CardPreviewModal } from '@/features/cards/components/CardPreviewModal'

type AuthValue = NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
type DataValue = NonNullable<ComponentProps<typeof DataContext.Provider>['value']>
type NavValue = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>
type Route = 'landing' | 'gallery' | 'community' | 'shared' | 'media' | 'docs' | 'about' | 'contact' | 'privacy' | 'disclaimer' | 'reset' | 'verify' | 'google' | 'notFound' | 'preview'
type State = 'populated' | 'empty' | 'loading' | 'error' | 'guest' | 'public' | 'alreadyImported' | 'missing' | 'success' | 'importing' | 'mismatch'
interface AuditArgs { route: Route; state: State; type: GalleryType }
const noop = () => {}
const asyncNoop = async () => {}
const persona = { ...characters[3], id: 'persona-audit', role: 'persona' as const, name: 'Wren', is_default_persona: true }
const fixtureArt = new URL(heroArt, window.location.origin).href
const cast = characters.map((card, index) => ({ ...card, role: 'character' as const, image_url: index === 0 ? fixtureArt : undefined, triggers: ['story', 'fantasy'] }))
const rawTemplates = templates.map(template => ({ ...template, name: template.scenario, description: template.scenario, world: template.world ? [template.world] : [] }))
const items = [{ id: 'item-audit', name: 'Moonlit compass', type: 'relic', rarity: 'rare', description: 'Points toward the promise you have not yet kept.', effects: {}, requirements: {}, limitations: {}, triggers: ['journey'] }]
const novels = [{ id: 'novel-audit', title: 'The last letter', description: 'A story of a lighthouse that remembers.', chapters: [{ id: 'chapter-audit', title: 'The harbor', body: 'The harbor slept while Wren read the last letter.', status: 'draft', order: 0 }], createdAt: '2026-09-17T18:00:00Z', updatedAt: '2026-09-19T05:00:00Z' }]
const lorebooks = [{ id: 'lore-audit', name: 'Harbor secrets', description: 'Promises and people of the candlelit coast.', enabled: true, entries: [{ id: 'entry-audit', name: 'The ferryman', enabled: true, isSecret: false, keys: ['ferryman'], content: 'One coin buys a crossing.' }], tags: ['coast'], attachments: [], metadata: {} }]
const fixtureError = new Error('The library could not be loaded. Please try again.')
const never = () => new Promise<never>(() => {})

function installMocks({ route, state, type }: AuditArgs) {
    const originalMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = query => query.includes('prefers-reduced-motion')
        ? { matches: true, media: query, onchange: null, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true }
        : originalMatchMedia(query)
    // Mock all service methods: unexpected actions fail locally, never reach an API.
    const service = apiService as unknown as Record<string, unknown>
    const saved = new Map<string, PropertyDescriptor | undefined>()
    const prototype = Object.getPrototypeOf(apiService)
    for (const key of Object.getOwnPropertyNames(prototype)) {
        if (key === 'constructor' || typeof service[key] !== 'function') continue
        saved.set(key, Object.getOwnPropertyDescriptor(apiService, key))
        Object.defineProperty(apiService, key, { configurable: true, writable: true, value: async () => { throw new Error(`Audit fixture has no handler for ${key}`) } })
    }
    const result = <T,>(value: T) => state === 'loading' ? never() : state === 'error' ? Promise.reject(fixtureError) : Promise.resolve(value)
    const rowSet = (kind: string) => kind === 'world' ? worlds : kind === 'item' ? items : kind === 'adventure_template' ? rawTemplates : type === 'persona' ? [persona] : cast
    const resource = (kind = 'character', card: unknown = cast[0]) => ({ card_type: kind, card, visibility: { public: true }, original_creator: { user_id: 7, username: 'The archivist' }, already_imported: state === 'alreadyImported', existing_card_id: state === 'alreadyImported' ? 'c1' : null })
    const list = (rows: unknown[], query?: string) => result(state === 'empty' || query?.includes('zzzz') ? [] : rows)
    Object.assign(service, {
        getCharacters: (_skip: number, _limit: number, query?: string, role?: string) => list(role === 'persona' ? [persona] : cast, query),
        getWorlds: (_skip: number, _limit: number, query?: string) => list(worlds, query),
        getItems: (_skip: number, _limit: number, query?: string) => list(items, query),
        getAdventureTemplates: (_skip: number, _limit: number, query?: string) => list(rawTemplates, query),
        getCharacter: () => result(cast[0]), getWorld: () => result(worlds[0]), getItem: () => result(items[0]), getAdventureTemplate: () => result(rawTemplates[0]),
        listPublicCards: (_skip: number, limit: number, _query?: string, kind = 'character', role?: string) => result({ items: state === 'empty' ? [] : (role === 'persona' ? [persona] : rowSet(kind)).map(card => resource(kind, card)), skip: 0, limit }),
        getSharedCard: () => result(resource()), getPublicCard: () => result(resource()),
        cloneCard: async () => resource(), importSharedCard: async () => resource(),
        listImageJobs: ({ cardType, cardId }: { cardType?: string; cardId?: string }) => result({ items: state === 'empty' || (cardType && cardType !== 'character') || (cardId && cardId !== 'c1') ? [] : [{ job_id: 'image-audit', status: 'completed', created_at: '2026-09-18T18:00:00Z', card_type: 'character', card_id: 'c1', card_name: cast[0].name, generation_prompt: 'A traveler rests beneath a candlelit arch, the sea visible beyond.', assets: [{ asset_id: 'image-one', url: fixtureArt }] }], next_offset: null }),
        listUserThemeSongs: ({ targetType, targetId }: { targetType?: string; targetId?: string }) => result({ items: state === 'empty' || (targetType && targetType !== 'world') || (targetId && targetId !== 'w1') ? [] : [{ job_id: 'theme-audit', status: 'completed', created_at: '2026-09-18T17:00:00Z', target: { type: 'world', id: 'w1', display_name: worlds[0].name }, assets: [{ asset_id: 'theme-one', url: 'data:audio/wav;base64,UklGRg==', duration_ms: 93000 }] }], next_offset: null }),
        deleteImageAsset: asyncNoop, deleteThemeSongAsset: asyncNoop,
        verifyEmail: () => result({ accepted: true }), resetPassword: () => result({ accepted: true }),
        getFeatureStatus: async () => ({}),
        listCardVersions: async () => ({ items: [] }), getCardUsage: async () => ({ items: [] }),
    })
    const oldHash = window.location.hash
    const oldDeepLink = sessionStorage.getItem('mw:auth-deeplink')
    clearAuthDeepLink()
    if (route === 'verify' || route === 'reset' || route === 'google') {
        const kind = route === 'verify' ? 'verify-email' : route === 'reset' ? 'password-reset' : 'google-login'
        if (state !== 'missing') sessionStorage.setItem('mw:auth-deeplink', JSON.stringify({ kind, token: 'storybook-only-token', ...(route === 'google' && state === 'error' ? { error: 'google_denied' } : {}) }))
    }
    const plural = { character: 'characters', persona: 'personas', world: 'worlds', item: 'items', adventure: 'adventures' }[type]
    const hash = ['reset', 'verify', 'google'].includes(route) && state !== 'missing' ? '#/auth-fixture?token=storybook-only-token' : route === 'shared' ? (state === 'missing' ? '#/shared/' : '#/shared/audit-token') : route === 'gallery' ? `#/gallery/${plural}${state === 'public' ? '?view=public' : ''}` : route === 'notFound' ? '#/the/forgotten/road/with/a/very/long/path-that-should-wrap-on-mobile' : ''
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    return () => {
        window.matchMedia = originalMatchMedia
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(apiService, key, descriptor)
            else delete service[key]
        }
        clearAuthDeepLink()
        if (oldDeepLink !== null) sessionStorage.setItem('mw:auth-deeplink', oldDeepLink)
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${oldHash}`)
    }
}

function Providers({ args, children }: { args: AuditArgs; children: ReactNode }) {
    const [notice, setNotice] = useState('')
    const empty = args.state === 'empty' || args.state === 'guest'
    const authed = args.state !== 'guest'
    const auth: AuthValue = {
        isAuthenticated: authed, user: authed ? { user_hash: 'audit', username: 'Lyra', user_type: 'consumer', email: null, created_at: null, updated_at: null } : null,
        token: null, projects: [], isLoading: false, error: null, sessionPhase: authed ? 'authenticated' : 'signed_out', authEpoch: 0, accountKey: 'audit', userHash: authed ? 'audit' : null,
        isLoginModalOpen: false, login: async () => false, register: async () => false, loginWithGoogle: asyncNoop, completeGoogleLogin: args.state === 'loading' ? never : async () => false,
        logout: asyncNoop, continueSignedOut: noop, updateUser: noop, clearError: noop, openLoginModal: () => setNotice('Sign-in action received by the isolated fixture.'), closeLoginModal: noop,
    }
    const data = new Proxy({
        characters: empty ? [] : [...cast, persona], worlds: empty ? [] : worlds, items: empty ? [] : items,
        templateAdventures: empty ? [] : templates, inProgressAdventures: empty ? [] : adventures, characterChats: empty ? [] : characterChats,
        stories: empty ? [] : novels, lorebooks: empty ? [] : lorebooks, isLoading: args.state === 'loading', loadingState: { isLoading: args.state === 'loading', error: args.state === 'error' ? fixtureError.message : null },
        error: args.state === 'error' ? fixtureError.message : null,
    }, { get: (target, key) => key in target ? Reflect.get(target, key) : asyncNoop }) as unknown as DataValue
    const navigation: NavValue = { currentPage: 'landing', previousPage: 'landing', currentHash: window.location.hash, cardEdit: null, resourceEdit: null, setPage: page => setNotice(`Navigation action: ${page}`), goBack: () => setNotice('Back action'), replaceHash: noop, registerNavigationInterceptor: () => noop }
    return <CookieConsentProvider><AuthContext.Provider value={auth}><DataContext.Provider value={data}><NavigationContext.Provider value={navigation}>
        {notice && <p role="status" className="p-3 text-caption text-fg-subtle">{notice}</p>}{children}
    </NavigationContext.Provider></DataContext.Provider></AuthContext.Provider></CookieConsentProvider>
}

function Screen(args: AuditArgs) {
    switch (args.route) {
        case 'preview': {
            const raw = args.type === 'world' ? worlds : args.type === 'item' ? items : args.type === 'adventure' ? rawTemplates : args.type === 'persona' ? [persona] : cast
            const item = GALLERY_CONFIG[args.type].toItems(raw)[0]
            const card = galleryItemToCardPreview(item)
            return <CardPreviewModal target={{ type: card.type, id: card.id, fallbackName: card.title }} card={args.state === 'loading' || args.state === 'error' ? null : card}
                loading={args.state === 'loading'} error={args.state === 'error' ? fixtureError.message : null} onClose={noop}
                originalCreatorName="The archivist" onImport={noop} onOpenExisting={args.state === 'alreadyImported' ? noop : undefined}
                alreadyImported={args.state === 'alreadyImported'} importing={args.state === 'importing'} />
        }
        case 'landing': return <LandingPage />
        case 'gallery': return <GalleryPage type={args.type} />
        case 'community': return <CommunityGalleryPage />
        case 'shared': return <SharedCardPage />
        case 'media': return <MediaGalleryPage />
        case 'docs': return <DocsPage />
        case 'about': case 'contact': case 'privacy': case 'disclaimer': return <LegalPage page={args.route} />
        case 'reset': return <PasswordResetPage />
        case 'verify': return <EmailVerifyPage />
        case 'google': return <GoogleCallbackPage />
        case 'notFound': return <NotFoundPage />
    }
}

function AuditViewport(args: AuditArgs) {
    if (new URLSearchParams(window.location.search).has('discoveryInner')) return <div className="-m-6"><Providers args={args}><Screen {...args} /></Providers></div>
    const url = new URL(window.location.href)
    url.searchParams.set('discoveryInner', 'true')
    return <div className="flex items-start gap-6">
        {[1280, 390].map(width => <section key={width} className="shrink-0 space-y-3">
            <p className="text-caption text-fg-subtle">{width === 1280 ? 'Desktop 1280' : 'Mobile 390'} · Isolated fixtures</p>
            <iframe title={`${width === 1280 ? 'Desktop' : 'Mobile'} ${args.route} ${args.state}`} src={url.toString()} style={{ width, height: 1060 }} className="border border-line-faint" />
        </section>)}
    </div>
}

const meta = {
    title: 'Audit/Discovery', component: AuditViewport, tags: ['autodocs'],
    parameters: { layout: 'fullscreen', docs: { description: { component: 'Actual discovery/public routes with deterministic service and context fixtures. The embedded iframe provides real 1280px and 390px responsive viewports without touching live user data.' } } },
    args: { route: 'gallery', state: 'populated', type: 'character' },
    beforeEach: context => installMocks(context.args),
    play: async ({ canvasElement, args }) => {
        if (!new URLSearchParams(window.location.search).has('discoveryInner') || args.route !== 'reset' || !['success', 'error', 'loading', 'mismatch'].includes(args.state)) return
        const canvas = within(canvasElement)
        // Synthetic, story-only form values; resetPassword is always an inert mock.
        await fireEvent.change(await canvas.findByLabelText(i18n.t('passwordReset.newPassword')), { target: { value: 'FictionalStorybookSecret7!' } })
        await fireEvent.change(canvas.getByLabelText(i18n.t('passwordReset.confirm')), { target: { value: args.state === 'mismatch' ? 'DifferentStorybookValue7!' : 'FictionalStorybookSecret7!' } })
        await fireEvent.click(canvas.getByRole('button', { name: i18n.t('passwordReset.submit') }))
    },
} satisfies Meta<typeof AuditViewport>
export default meta
type Story = StoryObj<typeof meta>

export const LandingReturning: Story = { args: { route: 'landing' } }
export const LandingGuest: Story = { args: { route: 'landing', state: 'guest' } }
export const LandingFresh: Story = { args: { route: 'landing', state: 'empty' } }
export const LandingLoading: Story = { args: { route: 'landing', state: 'loading' } }
export const Characters: Story = {}
export const Personas: Story = { args: { type: 'persona' } }
export const Worlds: Story = { args: { type: 'world' } }
export const Items: Story = { args: { type: 'item' } }
export const Adventures: Story = { args: { type: 'adventure' } }
export const GalleryEmpty: Story = { args: { state: 'empty' } }
export const GalleryLoading: Story = { args: { state: 'loading' } }
export const GalleryError: Story = { args: { state: 'error' } }
export const GalleryGuest: Story = { args: { state: 'guest' } }
export const PublicCharacters: Story = { args: { state: 'public' } }
export const PublicPersonas: Story = { args: { type: 'persona', state: 'public' } }
export const PublicWorlds: Story = { args: { type: 'world', state: 'public' } }
export const PublicItems: Story = { args: { type: 'item', state: 'public' } }
export const PublicAdventures: Story = { args: { type: 'adventure', state: 'public' } }
export const Community: Story = { args: { route: 'community' } }
export const CommunityEmpty: Story = { args: { route: 'community', state: 'empty' } }
export const CommunityLoading: Story = { args: { route: 'community', state: 'loading' } }
export const CommunityError: Story = { args: { route: 'community', state: 'error' } }
export const Shared: Story = { args: { route: 'shared' } }
export const SharedImported: Story = { args: { route: 'shared', state: 'alreadyImported' } }
export const SharedLoading: Story = { args: { route: 'shared', state: 'loading' } }
export const SharedError: Story = { args: { route: 'shared', state: 'error' } }
export const Media: Story = { args: { route: 'media' } }
export const MediaEmpty: Story = { args: { route: 'media', state: 'empty' } }
export const MediaLoading: Story = { args: { route: 'media', state: 'loading' } }
export const MediaError: Story = { args: { route: 'media', state: 'error' } }
export const MediaGuest: Story = { args: { route: 'media', state: 'guest' } }
export const Guide: Story = { args: { route: 'docs' } }
export const About: Story = { args: { route: 'about' } }
export const Contact: Story = { args: { route: 'contact' } }
export const Privacy: Story = { args: { route: 'privacy' } }
export const Disclaimer: Story = { args: { route: 'disclaimer' } }
export const ResetForm: Story = { args: { route: 'reset' } }
export const ResetMissing: Story = { args: { route: 'reset', state: 'missing' } }
export const VerifySuccess: Story = { args: { route: 'verify', state: 'success' } }
export const VerifyLoading: Story = { args: { route: 'verify', state: 'loading' } }
export const VerifyError: Story = { args: { route: 'verify', state: 'error' } }
export const VerifyMissing: Story = { args: { route: 'verify', state: 'missing' } }
export const GoogleLoading: Story = { args: { route: 'google', state: 'loading' } }
export const GoogleError: Story = { args: { route: 'google', state: 'error' } }
export const NotFound: Story = { args: { route: 'notFound' } }

export const PreviewCharacter: Story = { args: { route: 'preview' } }
export const PreviewPersona: Story = { args: { route: 'preview', type: 'persona' } }
export const PreviewWorld: Story = { args: { route: 'preview', type: 'world' } }
export const PreviewItem: Story = { args: { route: 'preview', type: 'item' } }
export const PreviewAdventure: Story = { args: { route: 'preview', type: 'adventure' } }
export const PreviewLoading: Story = { args: { route: 'preview', state: 'loading' } }
export const PreviewError: Story = { args: { route: 'preview', state: 'error' } }
export const PreviewImported: Story = { args: { route: 'preview', state: 'alreadyImported' } }
export const PreviewImporting: Story = { args: { route: 'preview', state: 'importing' } }

export const SharedGuest: Story = { args: { route: 'shared', state: 'guest' } }
export const SharedMissing: Story = { args: { route: 'shared', state: 'missing' } }
export const ResetSuccess: Story = { args: { route: 'reset', state: 'success' } }
export const ResetError: Story = { args: { route: 'reset', state: 'error' } }
export const ResetSubmitting: Story = { args: { route: 'reset', state: 'loading' } }
export const ResetMismatch: Story = { args: { route: 'reset', state: 'mismatch' } }
