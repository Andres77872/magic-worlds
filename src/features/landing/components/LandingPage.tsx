/**
 * Landing — an adaptive front door.
 *
 * Guests and fresh accounts get the marketing experience: a hero, a prominent
 * create menu, a "how it works" explainer, a row of sample worlds, and a closing
 * invitation. Returning users get a zoned dashboard in a deliberate top-to-bottom
 * narrative: resume the last thread (cinematic carousel) → make something new
 * (fast-create band) → continue what's active (adventures / chats / novels rails)
 * → start a new adventure → your cast → and the quieter reference shelves
 * (lorebooks, worlds, items). A global search sweeps across everything they own.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpenText, Feather, Gem, Globe, MessageCircle, Swords, Users, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import type { Adventure, Character, CharacterChatSession, Item, Lorebook, PageType, Story, StoryCreateRequest, World } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { NovelCreateModal } from '@/features/novel/components/NovelCreateModal'
import { PersonaPickerDialog } from '@/ui/components'
import { Button } from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { LandingLoading } from './LandingLoading'
import { GreetingHeader } from './GreetingHeader'
import { HeroScene, type HeroSceneProps } from './HeroScene'
import { HeroSessionGallery } from './HeroSessionGallery'
import { CreateBand } from './CreateBand'
import { ContinueRail } from './ContinueRail'
import { ContinueCard } from './ContinueCard'
import { BeginZone } from './BeginZone'
import { CastRail } from './CastRail'
import { LibraryRail } from './LibraryRail'
import { LorebookRail } from './LorebookRail'
import { SearchResults } from './SearchResults'
import { LandingHero, type HeroCta } from './LandingHero'
import { AccessMenu } from './AccessMenu'
import { HowItWorksSection } from './HowItWorksSection'
import { TwoWaysToPlay } from './TwoWaysToPlay'
import { ShowcaseWorlds } from './ShowcaseWorlds'
import { ClosingCTA } from './ClosingCTA'
import { LandingFooter } from './LandingFooter'
import { toScene, sceneMatchesFilter, genresFromScenes } from './sceneModel'
import { type ResumeSession } from './resumeModel'
import { searchDashboard, type DashboardSearchGroup } from './searchModel'
import { itemCardProps, worldCardProps } from './libraryCards'
import { type CreateAction } from './landingContent'
import { useDashboardModel } from '../hooks/useDashboardModel'

const GALLERY_PAGE_BY_GROUP: Partial<Record<DashboardSearchGroup['key'], PageType>> = {
    adventures: 'gallery-adventures',
    cast: 'gallery-characters',
    personas: 'gallery-personas',
    worlds: 'gallery-worlds',
    items: 'gallery-items',
    novels: 'gallery-stories',
}

const BEGIN_ZONE_ID = 'begin-zone'

function startErrorCopy(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function LandingPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        characters,
        worlds,
        items,
        templateAdventures,
        inProgressAdventures,
        isLoading,
        editCharacter,
        setEditingCharacter,
        deleteCharacter,
        editWorld,
        setEditingWorld,
        deleteWorld,
        editItem,
        setEditingItem,
        deleteItem,
        editTemplate,
        setEditingTemplate,
        startTemplate,
        deleteTemplate,
        editInProgress,
        deleteInProgress,
        startCharacterChat,
        characterChats,
        resumeCharacterChat,
        deleteCharacterChat,
        stories,
        openStory,
        createStory,
        lorebooks,
        editLorebook,
        setEditingLorebook,
        deleteLorebook,
        loadData,
        loadingState,
    } = useData()

    const {
        resumeSessions,
        searchSessions,
        activeAdventureSessions,
        activeChatSessions,
        activeNovelSessions,
        personaCards,
        aiCharacters,
        railWorlds,
        railItems,
        railLorebooks,
        counts,
    } = useDashboardModel()

    // Refresh the dashboard in the background each time it's shown. AppRouter
    // unmounts/remounts this page on navigation, so returning from a creator
    // re-fetches and picks up media (theme/portrait) the creators persisted
    // without a loadData. Silent → no full-screen spinner, no unmount loop.
    useEffect(() => {
        void loadData({ silent: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('All')
    const [pendingDelete, setPendingDelete] = useState<Adventure | null>(null)
    const [pendingSessionDelete, setPendingSessionDelete] = useState<Adventure | null>(null)
    const [pendingChatDelete, setPendingChatDelete] = useState<CharacterChatSession | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [novelModalOpen, setNovelModalOpen] = useState(false)
    const [creatingNovel, setCreatingNovel] = useState(false)
    const [personaPick, setPersonaPick] = useState<
        | { kind: 'adventure'; template: Adventure }
        | { kind: 'chat'; character: Character }
        | null
    >(null)
    const [personaPickError, setPersonaPickError] = useState<string | null>(null)
    const [isPersonaPickConfirming, setIsPersonaPickConfirming] = useState(false)
    const showcaseRef = useRef<HTMLElement>(null)

    // Every action that mutates or starts requires auth — open the modal if not.
    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const handleTemplateStart = (t: Adventure) => requireAuth(() => {
        setPersonaPickError(null)
        setPersonaPick({ kind: 'adventure', template: t })
    })
    const handleTemplateEdit = (t: Adventure) => requireAuth(() => { editTemplate(t); setPage('adventure') })
    const handleCharacterEdit = (c: Character) => requireAuth(() => { editCharacter(c); setPage('character') })
    const handleCharacterChat = (c: Character) => requireAuth(() => {
        setPersonaPickError(null)
        setPersonaPick({ kind: 'chat', character: c })
    })
    const handleWorldEdit = (w: World) => requireAuth(() => { editWorld(w); setPage('world') })
    const handleItemEdit = (item: Item) => requireAuth(() => { editItem(item); setPage('item') })
    const handleLorebookOpen = (lorebook: Lorebook) => requireAuth(() => { editLorebook(lorebook); setPage('lorebook') })
    const handleStoryOpen = (story: Story) => requireAuth(() => {
        void openStory(story)
            .then(() => setPage('story'))
            .catch((error) => console.error('Failed to open story:', error))
    })

    const openSession = (session: ResumeSession) => requireAuth(() => {
        if (session.kind === 'adventure') {
            editInProgress(session.source as Adventure)
            setPage('interaction')
        } else if (session.kind === 'chat') {
            resumeCharacterChat(session.source as CharacterChatSession)
            setPage('character-chat')
        } else {
            void openStory(session.source as Story)
                .then(() => setPage('story'))
                .catch((error) => console.error('Failed to open story:', error))
        }
    })

    const createAdventure = () => requireAuth(() => { setEditingTemplate(null); setPage('adventure') })
    const createCharacter = () => requireAuth(() => { setEditingCharacter(null); setPage('character') })
    const createWorld = () => requireAuth(() => { setEditingWorld(null); setPage('world') })
    const createItem = () => requireAuth(() => { setEditingItem(null); setPage('item') })
    const createLorebook = () => requireAuth(() => { setEditingLorebook(null); setPage('lorebook') })
    const openNovelCreate = () => requireAuth(() => setNovelModalOpen(true))
    const handleCreate = (key: CreateAction['key']) => {
        if (key === 'character') createCharacter()
        else if (key === 'world') createWorld()
        else if (key === 'item') createItem()
        else if (key === 'adventure') createAdventure()
        else if (key === 'novel') openNovelCreate()
        else if (key === 'lorebook') createLorebook()
    }

    const handleNovelCreate = async (request: StoryCreateRequest) => {
        if (creatingNovel) return
        setCreatingNovel(true)
        try {
            await createStory(request)
            setNovelModalOpen(false)
            setPage('story')
        } catch (error) {
            console.error('Failed to create novel:', error)
        } finally {
            setCreatingNovel(false)
        }
    }

    const confirmTemplateDelete = () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        requireAuth(() => {
            const index = templateAdventures.indexOf(target)
            if (index >= 0) deleteTemplate(index)
        })
    }

    const confirmSessionDelete = async () => {
        const target = pendingSessionDelete
        setPendingSessionDelete(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            const index = inProgressAdventures.indexOf(target)
            if (index >= 0) await deleteInProgress(index)
        } catch (error) {
            console.error('Failed to delete adventure session:', error)
        } finally {
            setDeletingId(null)
        }
    }

    const confirmChatDelete = async () => {
        const target = pendingChatDelete
        setPendingChatDelete(null)
        if (!target) return
        setDeletingId(target.id)
        try {
            await deleteCharacterChat(target.id)
        } catch (error) {
            console.error('Failed to delete character chat:', error)
        } finally {
            setDeletingId(null)
        }
    }

    const scenes = useMemo(() => templateAdventures.map(toScene), [templateAdventures])
    const genres = useMemo(() => genresFromScenes(scenes), [scenes])
    // Chips scope the Begin zone only; the search field sweeps everything.
    const chipFiltered = useMemo(
        () => scenes.filter((scene) => sceneMatchesFilter(scene, filter)),
        [scenes, filter],
    )
    // Defer the search recompute + result render off the keystroke so typing in
    // a content-heavy account stays responsive (the input value stays live).
    const deferredQuery = useDeferredValue(query)
    const search = useMemo(
        () =>
            searchDashboard(deferredQuery, {
                sessions: searchSessions,
                scenes,
                cast: aiCharacters,
                personas: personaCards,
                worlds,
                items,
                stories,
            }),
        [deferredQuery, searchSessions, scenes, aiCharacters, personaCards, worlds, items, stories],
    )

    // Content-based mode: an authenticated-but-empty account still gets the
    // welcoming front-door (it doubles as the empty state).
    const hasScenes = templateAdventures.length > 0
    const hasContent = hasScenes || inProgressAdventures.length > 0 || characters.length > 0 || worlds.length > 0 || items.length > 0 || characterChats.length > 0 || stories.length > 0 || lorebooks.length > 0
    const mode: 'guest' | 'returning' = isAuthenticated && hasContent ? 'returning' : 'guest'

    const closePersonaPick = () => {
        if (isPersonaPickConfirming) return
        setPersonaPick(null)
        setPersonaPickError(null)
    }

    const confirmPersonaPick = async (persona: Character) => {
        const pending = personaPick
        if (!pending || isPersonaPickConfirming) return
        setPersonaPickError(null)
        setIsPersonaPickConfirming(true)
        try {
            if (pending.kind === 'adventure') {
                await startTemplate(pending.template, persona)
                setPersonaPick(null)
                setPage('interaction')
            } else {
                await startCharacterChat(pending.character, persona)
                setPersonaPick(null)
                setPage('character-chat')
            }
        } catch (error) {
            const fallback = pending.kind === 'adventure'
                ? t('landing.persona.beginAdventureError')
                : t('landing.persona.startChatError')
            setPersonaPickError(startErrorCopy(error, fallback))
        } finally {
            setIsPersonaPickConfirming(false)
        }
    }

    const prefersReducedMotion = () =>
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const scrollToShowcase = () => {
        showcaseRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }
    // By id, not ref: the hero captures this callback, and a ref read inside it
    // would trip the React Compiler's render-safety analysis on the hero object.
    const scrollToBegin = () => {
        document.getElementById(BEGIN_ZONE_ID)?.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start',
        })
    }

    if (isLoading) {
        return <LandingLoading />
    }

    // ---------- GUEST: marketing front-door ----------
    if (mode === 'guest') {
        const heroPrimary: HeroCta = isAuthenticated
            ? { label: t('landing.hero.authedPrimary'), icon: Wand2, onClick: createAdventure }
            : { label: t('landing.hero.guestPrimary'), icon: Feather, onClick: createAdventure }
        const heroSecondary: HeroCta = isAuthenticated
            ? { label: t('landing.hero.authedSecondary'), icon: Users, onClick: createCharacter }
            : { label: t('landing.hero.guestSecondary'), iconRight: ArrowRight, onClick: scrollToShowcase }
        const accessCopy = isAuthenticated
            ? { eyebrow: t('landing.access.authedEyebrow'), title: t('landing.access.authedTitle') }
            : { eyebrow: t('landing.access.guestEyebrow'), title: t('landing.access.guestTitle') }

        return (
            <div className="flex w-full flex-col">
                <LandingHero
                    eyebrow={t('landing.hero.eyebrow')}
                    title={t('landing.hero.title')}
                    subtitle={t('landing.hero.subtitle')}
                    primary={heroPrimary}
                    secondary={heroSecondary}
                    stat={t('landing.hero.stat')}
                />
                <AccessMenu
                    eyebrow={accessCopy.eyebrow}
                    title={accessCopy.title}
                    onAction={handleCreate}
                />
                <HowItWorksSection />
                <TwoWaysToPlay />
                <ShowcaseWorlds sectionRef={showcaseRef} onTry={createAdventure} />
                <ClosingCTA onAction={createAdventure} />
                <LandingFooter onNavigate={setPage} />
            </div>
        )
    }

    // ---------- RETURNING: zoned dashboard ----------
    // Section 1 hero falls back to a featured "begin" scene only when there are
    // no resumable threads at all; otherwise the carousel is the opener.
    const heroScene = resumeSessions.length === 0 ? chipFiltered[0] : undefined
    const gridScenes = heroScene ? chipFiltered.slice(1) : chipFiltered

    const hero: HeroSceneProps | null = heroScene
          ? {
                mode: 'begin',
                eyebrow: heroScene.location
                    ? t('landing.heroScene.featuredWithLocation', { location: heroScene.location })
                    : t('landing.heroScene.featured'),
                title: heroScene.title,
                description: heroScene.description,
                imageUrl: heroScene.template.image_url,
                seed: heroScene.title,
                monogram: heroScene.monogram,
                tags: heroScene.tags,
                primary: {
                    label: MODE_META.adventure.beginLabel,
                    icon: Wand2,
                    onClick: () => handleTemplateStart(heroScene.template),
                },
                secondary: { label: t('landing.heroScene.viewAllAdventures'), onClick: () => setPage('gallery-adventures') },
            }
          : null

    const hasDiscreteShelf = counts.lorebooks > 0 || counts.worlds > 0 || counts.items > 0

    return (
        <div className="flex w-full flex-col">
            {/* Non-blocking notice when the initial load partially failed: the page
                still renders whatever loaded, with a retry. */}
            {loadingState.error && (
                <div className="mx-auto mt-4 flex w-full max-w-[1240px] items-center justify-between gap-3 rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-3 text-[14px] text-blood-500 sm:px-8">
                    <span>{t('common.loadError')}</span>
                    <Button kind="secondary" size="sm" onClick={() => void loadData()}>{t('common.tryAgain')}</Button>
                </div>
            )}
            {/* ZONE 1 — hero: greeting + global search + the cinematic opener.
                Ambient candlelight comes from the app shell (AppRouter), not a
                section-scoped glow, so it never crops at this boundary. */}
            <section className="relative">
                <div className="relative mx-auto w-full max-w-[1240px] px-5 pt-8 sm:px-8 sm:pt-10">
                    <div className="pb-6">
                        <GreetingHeader
                            query={query}
                            onQueryChange={setQuery}
                            resultsCount={search.active ? search.total : undefined}
                        />
                    </div>
                    {!search.active && resumeSessions.length > 0 && (
                        <HeroSessionGallery sessions={resumeSessions} onOpen={openSession} onBeginNew={scrollToBegin} />
                    )}
                    {!search.active && hero && <HeroScene {...hero} />}
                </div>
            </section>

            {search.active ? (
                <div className="mx-auto w-full max-w-[1160px] px-5 pb-16 pt-10 sm:px-8">
                    <SearchResults
                        results={search}
                        onClear={() => setQuery('')}
                        onOpenSession={openSession}
                        onBeginTemplate={handleTemplateStart}
                        onChatCharacter={handleCharacterChat}
                        onEditCharacter={handleCharacterEdit}
                        onEditWorld={handleWorldEdit}
                        onEditItem={handleItemEdit}
                        onOpenStory={handleStoryOpen}
                        onCreateAdventure={createAdventure}
                        onViewGallery={(key) => {
                            const page = GALLERY_PAGE_BY_GROUP[key]
                            if (page) setPage(page)
                        }}
                    />
                </div>
            ) : (
                <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-12 px-5 pb-16 pt-12 sm:gap-14 sm:px-8">
                    {/* 2 — fast creation access */}
                    <CreateBand onAction={handleCreate} />

                    {/* 3 — continue active adventures */}
                    <ContinueRail
                        title={t('landing.continue.adventures')}
                        icon={Swords}
                        tone="ember"
                        items={activeAdventureSessions}
                        total={counts.adventures}
                        getItemKey={(session) => session.id}
                        onViewAll={() => setPage('gallery-adventures')}
                        data-testid="active-adventures"
                        renderCard={(session) => (
                            <ContinueCard
                                session={session}
                                onContinue={() => openSession(session)}
                                onDelete={() => setPendingSessionDelete(session.source as Adventure)}
                                deleting={deletingId === session.id}
                            />
                        )}
                    />

                    {/* 4 — pick up a conversation (1:1 + group) */}
                    <ContinueRail
                        title={t('landing.continue.conversation')}
                        icon={MessageCircle}
                        tone="arcane"
                        items={activeChatSessions}
                        viewAllLabel={t('landing.continue.openChatroom')}
                        getItemKey={(session) => session.id}
                        onViewAll={() => setPage('chatroom')}
                        data-testid="active-chats"
                        renderCard={(session) => (
                            <ContinueCard
                                session={session}
                                onContinue={() => openSession(session)}
                                onDelete={() => setPendingChatDelete(session.source as CharacterChatSession)}
                                deleting={deletingId === session.id}
                            />
                        )}
                    />

                    {/* 5 — back to your writing */}
                    <ContinueRail
                        title={t('landing.continue.writing')}
                        icon={BookOpenText}
                        tone="ember"
                        items={activeNovelSessions}
                        total={counts.novels}
                        getItemKey={(session) => session.id}
                        onViewAll={() => setPage('gallery-stories')}
                        data-testid="active-novels"
                        renderCard={(session) => (
                            <ContinueCard session={session} onContinue={() => openSession(session)} />
                        )}
                    />

                    {/* 6 — start a new adventure */}
                    <div id={BEGIN_ZONE_ID}>
                        <BeginZone
                            scenes={gridScenes}
                            totalCount={templateAdventures.length}
                            genres={genres}
                            filter={filter}
                            onFilterChange={setFilter}
                            onBegin={handleTemplateStart}
                            onEdit={handleTemplateEdit}
                            onDelete={setPendingDelete}
                            onViewAll={() => setPage('gallery-adventures')}
                            onCreate={createAdventure}
                        />
                    </div>

                    {/* 7 — your cast (1:1 chat entry point) */}
                    {aiCharacters.length > 0 && (
                        <CastRail
                            cast={aiCharacters}
                            onChat={handleCharacterChat}
                            onEdit={handleCharacterEdit}
                            onDelete={(character) => deleteCharacter(character.id)}
                            onViewAll={() => setPage('gallery-characters')}
                        />
                    )}

                    {/* 8–10 — the quiet reference shelves: lore, worlds, items */}
                    {hasDiscreteShelf && (
                        <div className="flex flex-col gap-10 border-t border-parchment-50/[.06] pt-10">
                            <LorebookRail
                                lorebooks={railLorebooks}
                                total={counts.lorebooks}
                                onOpen={handleLorebookOpen}
                                onDelete={(lorebook) => deleteLorebook(lorebook.id)}
                                onViewAll={() => setPage('gallery-lorebooks')}
                            />
                            <LibraryRail
                                title={t('landing.rail.worldsTitle')}
                                icon={Globe}
                                tone="ember"
                                items={railWorlds}
                                total={counts.worlds}
                                cardType="world"
                                deleteTitle={t('landing.rail.deleteWorldTitle')}
                                toCard={worldCardProps}
                                onEdit={handleWorldEdit}
                                onDelete={(world) => deleteWorld(world.id)}
                                onViewAll={() => setPage('gallery-worlds')}
                                data-testid="worlds-rail"
                            />
                            <LibraryRail
                                title={t('landing.rail.itemsTitle')}
                                icon={Gem}
                                tone="ember"
                                items={railItems}
                                total={counts.items}
                                cardType="item"
                                deleteTitle={t('landing.rail.deleteItemTitle')}
                                toCard={itemCardProps}
                                onEdit={handleItemEdit}
                                onDelete={(item) => deleteItem(item.id)}
                                onViewAll={() => setPage('gallery-items')}
                                data-testid="items-rail"
                            />
                        </div>
                    )}
                </div>
            )}

            <LandingFooter onNavigate={setPage} />

            <NovelCreateModal
                open={novelModalOpen}
                creating={creatingNovel}
                onClose={() => setNovelModalOpen(false)}
                onCreate={handleNovelCreate}
            />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('landing.delete.adventureTitle')}
                message={
                    pendingDelete
                        ? t('landing.delete.adventureMessage', { name: pendingDelete.scenario?.slice(0, 80) || t('landing.delete.thisAdventure') })
                        : ''
                }
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={confirmTemplateDelete}
                onCancel={() => setPendingDelete(null)}
            />

            <ConfirmDialog
                visible={pendingSessionDelete !== null}
                title={t('landing.delete.inProgressTitle')}
                message={
                    pendingSessionDelete
                        ? t('landing.delete.adventureMessage', { name: pendingSessionDelete.scenario?.slice(0, 80) || t('landing.delete.thisAdventure') })
                        : ''
                }
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={() => void confirmSessionDelete()}
                onCancel={() => setPendingSessionDelete(null)}
            />

            <ConfirmDialog
                visible={pendingChatDelete !== null}
                title={t('landing.delete.chatTitle')}
                message={
                    pendingChatDelete
                        ? t('landing.delete.chatMessage', { name: pendingChatDelete.character?.name?.slice(0, 80) || t('landing.delete.thisChat') })
                        : ''
                }
                confirmLabel={t('gallery.delete')}
                variant="danger"
                onConfirm={() => void confirmChatDelete()}
                onCancel={() => setPendingChatDelete(null)}
            />

            <PersonaPickerDialog
                open={personaPick !== null}
                title={personaPick?.kind === 'chat' ? t('landing.persona.chatTitle') : t('landing.persona.adventureTitle')}
                actionLabel={personaPick?.kind === 'chat' ? t('landing.persona.startChat') : t('landing.persona.beginAdventure')}
                description={
                    personaPick?.kind === 'chat'
                        ? t('landing.persona.chatDescription')
                        : t('landing.persona.adventureDescription')
                }
                error={personaPickError}
                isConfirming={isPersonaPickConfirming}
                characters={characters}
                onConfirm={confirmPersonaPick}
                onClose={closePersonaPick}
                onCreateCharacter={() => {
                    if (isPersonaPickConfirming) return
                    setPersonaPick(null)
                    setPersonaPickError(null)
                    setEditingCharacter(null)
                    setPage('character')
                }}
            />
        </div>
    )
}
