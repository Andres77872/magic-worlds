/**
 * Landing — an adaptive front door.
 *
 * Guests and fresh accounts get the marketing experience: a hero, a prominent
 * create menu, a "how it works" explainer, a row of sample worlds, and a closing
 * invitation. Returning users get a zoned dashboard: a cinematic recent-session
 * gallery (or featured begin hero), the begin-anew discovery grid with the cast
 * rail, a tabbed library band, and the create workbench — with a global search
 * that sweeps across everything they own.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Feather, MessageCircle, Users, Wand2 } from 'lucide-react'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import type { Adventure, Character, CharacterChatSession, Item, PageType, Story, World } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { PersonaPickerDialog } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { isAiCharacterCard, isPersonaCard } from '@/utils/characterRoles'
import { LandingLoading } from './LandingLoading'
import { GreetingHeader } from './GreetingHeader'
import { HeroScene, type HeroSceneProps } from './HeroScene'
import { HeroSessionGallery } from './HeroSessionGallery'
import { BeginZone } from './BeginZone'
import { CastRail } from './CastRail'
import { LibraryShelf, type LibraryTab } from './LibraryShelf'
import { CreateBand } from './CreateBand'
import { SearchResults } from './SearchResults'
import { LandingHero, type HeroCta } from './LandingHero'
import { ResumeCard } from './ResumeCard'
import { AccessMenu } from './AccessMenu'
import { HowItWorksSection } from './HowItWorksSection'
import { TwoWaysToPlay } from './TwoWaysToPlay'
import { ShowcaseWorlds } from './ShowcaseWorlds'
import { ClosingCTA } from './ClosingCTA'
import { LandingFooter } from './LandingFooter'
import { toScene, sceneMatchesFilter, genresFromScenes } from './sceneModel'
import { toResumeSessions, type ResumeSession } from './resumeModel'
import { searchDashboard, type DashboardSearchGroup } from './searchModel'
import { HERO_COPY, type CreateAction } from './landingContent'

const GALLERY_PAGE_BY_GROUP: Partial<Record<DashboardSearchGroup['key'], PageType>> = {
    adventures: 'gallery-adventures',
    cast: 'gallery-characters',
    personas: 'gallery-personas',
    worlds: 'gallery-worlds',
    items: 'gallery-items',
    novels: 'gallery-stories',
}

const GALLERY_PAGE_BY_TAB: Record<LibraryTab, PageType> = {
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
        startCharacterChat,
        characterChats,
        resumeCharacterChat,
        deleteCharacterChat,
        stories,
        openStory,
        loadData,
    } = useData()

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
    const [pendingChatDelete, setPendingChatDelete] = useState<CharacterChatSession | null>(null)
    const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
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
    const handleStoryOpen = (story: Story) => requireAuth(() => {
        void openStory(story)
            .then(() => {
                setPage('story')
            })
            .catch((error) => {
                console.error('Failed to open story:', error)
            })
    })

    const openSession = (session: ResumeSession) => requireAuth(() => {
        if (session.kind === 'adventure') {
            editInProgress(session.source as Adventure)
            setPage('interaction')
        } else {
            resumeCharacterChat(session.source as CharacterChatSession)
            setPage('character-chat')
        }
    })

    const createAdventure = () => requireAuth(() => { setEditingTemplate(null); setPage('adventure') })
    const createCharacter = () => requireAuth(() => { setEditingCharacter(null); setPage('character') })
    const createWorld = () => requireAuth(() => { setEditingWorld(null); setPage('world') })
    const createItem = () => requireAuth(() => { setEditingItem(null); setPage('item') })
    const handleCreate = (key: CreateAction['key']) => {
        if (key === 'character') createCharacter()
        else if (key === 'world') createWorld()
        else if (key === 'item') createItem()
        else createAdventure()
    }
    const handleLibraryCreate = (tab: Exclude<LibraryTab, 'novels'>) => {
        if (tab === 'personas') createCharacter()
        else if (tab === 'worlds') createWorld()
        else createItem()
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

    const confirmChatDelete = async () => {
        const target = pendingChatDelete
        setPendingChatDelete(null)
        if (!target) return
        setDeletingChatId(target.id)
        try {
            await deleteCharacterChat(target.id)
        } catch (error) {
            console.error('Failed to delete character chat:', error)
        } finally {
            setDeletingChatId(null)
        }
    }

    const scenes = useMemo(() => templateAdventures.map(toScene), [templateAdventures])
    const personaCards = useMemo(() => characters.filter(isPersonaCard), [characters])
    const aiCharacters = useMemo(() => characters.filter(isAiCharacterCard), [characters])
    const sessions = useMemo(
        () => toResumeSessions(inProgressAdventures, characterChats),
        [inProgressAdventures, characterChats],
    )
    const chatSessions = useMemo(
        () => toResumeSessions([], characterChats).slice(0, 4),
        [characterChats],
    )
    const genres = useMemo(() => genresFromScenes(scenes), [scenes])
    // Chips scope the Begin zone only; the search field sweeps everything.
    const chipFiltered = useMemo(
        () => scenes.filter((scene) => sceneMatchesFilter(scene, filter)),
        [scenes, filter],
    )
    const search = useMemo(
        () =>
            searchDashboard(query, {
                sessions,
                scenes,
                cast: aiCharacters,
                personas: personaCards,
                worlds,
                items,
                stories,
            }),
        [query, sessions, scenes, aiCharacters, personaCards, worlds, items, stories],
    )

    // Content-based mode: an authenticated-but-empty account still gets the
    // welcoming front-door (it doubles as the empty state).
    const hasScenes = templateAdventures.length > 0
    const hasContent = hasScenes || inProgressAdventures.length > 0 || characters.length > 0 || worlds.length > 0 || items.length > 0 || characterChats.length > 0 || stories.length > 0
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
                ? 'Could not begin this adventure. Please try again.'
                : 'Could not start this chat. Please try again.'
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
            ? { label: 'Create your first adventure', icon: Wand2, onClick: createAdventure }
            : { label: 'Begin an adventure', icon: Feather, onClick: createAdventure }
        const heroSecondary: HeroCta = isAuthenticated
            ? { label: 'New character', icon: Users, onClick: createCharacter }
            : { label: 'Explore worlds', iconRight: ArrowRight, onClick: scrollToShowcase }
        const accessCopy = isAuthenticated
            ? { eyebrow: 'Begin your first tale', title: 'Your worlds await their first spark' }
            : { eyebrow: 'Make it yours', title: 'Create your own cast and worlds' }

        return (
            <div className="flex w-full flex-col">
                <LandingHero
                    eyebrow={HERO_COPY.eyebrow}
                    title={HERO_COPY.title}
                    subtitle={HERO_COPY.subtitle}
                    primary={heroPrimary}
                    secondary={heroSecondary}
                    stat={HERO_COPY.stat}
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
    const heroSessions = sessions.slice(0, 10)
    // In begin mode the hero takes the first chip-filtered scene; the grid gets the rest.
    const heroScene = heroSessions.length === 0 ? chipFiltered[0] : undefined
    const gridScenes = heroScene ? chipFiltered.slice(1) : chipFiltered

    const hero: HeroSceneProps | null = heroScene
          ? {
                mode: 'begin',
                eyebrow: `Featured adventure${heroScene.location ? ` · ${heroScene.location}` : ''}`,
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
                secondary: { label: 'View all adventures', onClick: () => setPage('gallery-adventures') },
            }
          : null

    return (
        <div className="flex w-full flex-col">
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
                    {!search.active && heroSessions.length > 0 && (
                        <HeroSessionGallery sessions={heroSessions} onOpen={openSession} onBeginNew={scrollToBegin} />
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
                    {chatSessions.length > 0 && (
                        <section className="flex flex-col gap-4" data-testid="character-chat-shelf">
                            <SectionHeader
                                icon={MessageCircle}
                                title="Active character conversations"
                                tone="arcane"
                                right={
                                    <Button
                                        kind="ghost"
                                        size="sm"
                                        iconRight={<Icon icon={ArrowRight} size={14} />}
                                        onClick={() => setPage('chatroom')}
                                    >
                                        Open chatroom
                                    </Button>
                                }
                            />
                            <div className="grid gap-4 md:grid-cols-2">
                                {chatSessions.map((session) => (
                                    <ResumeCard
                                        key={session.id}
                                        session={session}
                                        onContinue={() => openSession(session)}
                                        onDelete={() => setPendingChatDelete(session.source as CharacterChatSession)}
                                        deleting={deletingChatId === session.id}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ZONE 2 — begin anew + the cast rail (chat entry point).
                        Tighter than the inter-zone gap so the sub-rail reads as
                        part of this zone, not a floating peer. */}
                    <div id={BEGIN_ZONE_ID} className="flex flex-col gap-8">
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
                        {aiCharacters.length > 0 && (
                            <CastRail
                                cast={aiCharacters}
                                onChat={handleCharacterChat}
                                onEdit={handleCharacterEdit}
                                onDelete={(character) => deleteCharacter(character.id)}
                                onViewAll={() => setPage('gallery-characters')}
                            />
                        )}
                    </div>

                    {/* ZONE 3 — the quiet library band */}
                    <LibraryShelf
                        personas={personaCards}
                        worlds={worlds}
                        items={items}
                        stories={stories}
                        onEditCharacter={handleCharacterEdit}
                        onDeleteCharacter={(character) => deleteCharacter(character.id)}
                        onEditWorld={handleWorldEdit}
                        onDeleteWorld={(world) => deleteWorld(world.id)}
                        onEditItem={handleItemEdit}
                        onDeleteItem={(item) => deleteItem(item.id)}
                        onOpenStory={handleStoryOpen}
                        onViewAll={(tab) => setPage(GALLERY_PAGE_BY_TAB[tab])}
                        onCreate={handleLibraryCreate}
                    />

                    {/* ZONE 4 — the create workbench */}
                    <CreateBand onAction={handleCreate} />
                </div>
            )}

            <LandingFooter onNavigate={setPage} />

            <ConfirmDialog
                visible={pendingDelete !== null}
                title="Delete adventure"
                message={
                    pendingDelete
                        ? `Delete "${pendingDelete.scenario?.slice(0, 80) || 'this adventure'}"? This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmTemplateDelete}
                onCancel={() => setPendingDelete(null)}
            />

            <ConfirmDialog
                visible={pendingChatDelete !== null}
                title="Delete chat"
                message={
                    pendingChatDelete
                        ? `Delete "${pendingChatDelete.character?.name?.slice(0, 80) || 'this chat'}"? This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => void confirmChatDelete()}
                onCancel={() => setPendingChatDelete(null)}
            />

            <PersonaPickerDialog
                open={personaPick !== null}
                title={personaPick?.kind === 'chat' ? 'Choose your persona' : 'Begin as'}
                actionLabel={personaPick?.kind === 'chat' ? 'Start chat' : 'Begin adventure'}
                description={
                    personaPick?.kind === 'chat'
                        ? 'Choose the persona who will speak for you in this conversation.'
                        : 'Choose the persona you will play before starting this adventure.'
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
