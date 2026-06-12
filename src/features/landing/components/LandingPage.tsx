/**
 * Landing — an adaptive front door.
 *
 * Guests and fresh accounts get the marketing experience: a hero, a prominent
 * create menu, a "how it works" explainer, a row of sample worlds, and a closing
 * invitation. Returning users with content get their personalised dashboard:
 * greeting + search, the discovery gallery, and shelves for in-progress journeys,
 * characters, and worlds — plus a compact create strip.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, BookOpenText, Feather, Play, Sparkles, Users, Wand2 } from 'lucide-react'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import type { Character, CharacterChatSession, World, Item, Adventure, Story } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { CharacterList, CharacterChatList, WorldList, ItemList, InProgressList, CardGrid, Card, PersonaPickerDialog } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { isAiCharacterCard, isPersonaCard } from '@/utils/characterRoles'
import { LandingLoading } from './LandingLoading'
import { GreetingHeader } from './GreetingHeader'
import { FilterChips } from './FilterChips'
import { FeaturedScene } from './FeaturedScene'
import { SceneCard } from './SceneCard'
import { LandingHero, type HeroCta } from './LandingHero'
import { AccessMenu } from './AccessMenu'
import { HowItWorksSection } from './HowItWorksSection'
import { TwoWaysToPlay } from './TwoWaysToPlay'
import { ShowcaseWorlds } from './ShowcaseWorlds'
import { ClosingCTA } from './ClosingCTA'
import { toScene, sceneTitle, sceneMatchesFilter, sceneMatchesQuery } from './sceneModel'
import { HERO_COPY, latestInProgress, type CreateAction } from './landingContent'

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
        deleteInProgress,
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
    const handleChatResume = (chat: CharacterChatSession) => requireAuth(() => { resumeCharacterChat(chat); setPage('character-chat') })
    const handleWorldEdit = (w: World) => requireAuth(() => { editWorld(w); setPage('world') })
    const handleItemEdit = (item: Item) => requireAuth(() => { editItem(item); setPage('item') })
    const handleInProgressEdit = (a: Adventure) => requireAuth(() => { editInProgress(a); setPage('interaction') })
    const handleStoryOpen = (story: Story) => requireAuth(() => {
        void openStory(story)
            .then(() => {
                setPage('story')
            })
            .catch((error) => {
                console.error('Failed to open story:', error)
            })
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

    const confirmTemplateDelete = () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        requireAuth(() => {
            const index = templateAdventures.indexOf(target)
            if (index >= 0) deleteTemplate(index)
        })
    }

    const scenes = useMemo(() => templateAdventures.map(toScene), [templateAdventures])
    const personaCards = useMemo(() => characters.filter(isPersonaCard), [characters])
    const aiCharacters = useMemo(() => characters.filter(isAiCharacterCard), [characters])

    // Genre chips reflect the tags actually present across the user's scenes.
    // Single-character scratch values read like leaked test data in a global filter.
    const genres = useMemo(() => {
        const byKey = new Map<string, string>()
        scenes.forEach((scene) =>
            scene.tags.forEach((tag) => {
                if (tag.trim().length < 2) return
                const key = tag.toLowerCase()
                if (!byKey.has(key)) byKey.set(key, tag)
            }),
        )
        return Array.from(byKey.values()).slice(0, 6)
    }, [scenes])

    const filtered = useMemo(
        () => scenes.filter((scene) => sceneMatchesFilter(scene, filter) && sceneMatchesQuery(scene, query)),
        [scenes, filter, query],
    )

    const featured = filtered[0]
    const rest = filtered.slice(1)

    const latest = useMemo(() => latestInProgress(inProgressAdventures), [inProgressAdventures])

    // Content-based mode: an authenticated-but-empty account still gets the
    // welcoming front-door (it doubles as the empty state).
    const hasScenes = templateAdventures.length > 0
    const hasInProgress = inProgressAdventures.length > 0
    const hasContent = hasScenes || hasInProgress || characters.length > 0 || worlds.length > 0 || items.length > 0 || characterChats.length > 0 || stories.length > 0
    const mode: 'guest' | 'returning' = isAuthenticated && hasContent ? 'returning' : 'guest'

    const resumeLatest = () =>
        requireAuth(() => {
            if (!latest) return
            editInProgress(latest)
            setPage('interaction')
        })

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

    const scrollToShowcase = () => {
        const reduce =
            typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        showcaseRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
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
                    variant="full"
                    eyebrow={accessCopy.eyebrow}
                    title={accessCopy.title}
                    onAction={handleCreate}
                />
                <HowItWorksSection />
                <TwoWaysToPlay />
                <ShowcaseWorlds sectionRef={showcaseRef} onTry={createAdventure} />
                <ClosingCTA onAction={createAdventure} />
            </div>
        )
    }

    // ---------- RETURNING: personalised dashboard ----------
    const resumeTitle = latest ? sceneTitle(latest) : ''
    const resumeShort = resumeTitle.length > 28 ? `${resumeTitle.slice(0, 27)}…` : resumeTitle
    const continueAction =
        hasInProgress && latest ? (
            <Button
                kind="primary"
                iconLeft={<Icon icon={Play} size={16} />}
                onClick={resumeLatest}
                className="shrink-0"
            >
                Continue: {resumeShort}
            </Button>
        ) : undefined

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
            <GreetingHeader query={query} onQueryChange={setQuery} action={continueAction} />

            {genres.length > 0 && <FilterChips options={genres} active={filter} onChange={setFilter} />}

            {hasScenes &&
                (featured ? (
                    <FeaturedScene
                        eyebrow={`Featured adventure${featured.location ? ` · ${featured.location}` : ''}`}
                        title={featured.title}
                        description={featured.description}
                        monogram={featured.monogram}
                        seed={featured.title}
                        tags={featured.tags}
                        actionLabel={MODE_META.adventure.beginLabel}
                        onAction={() => handleTemplateStart(featured.template)}
                    />
                ) : (
                    <NoMatches onClear={() => { setQuery(''); setFilter('All') }} />
                ))}

            {rest.length > 0 && (
                <section className="flex flex-col gap-5">
                    <div className="flex items-end justify-between gap-4">
                        <h2 className="font-display text-h3 font-semibold text-parchment-50">More adventures to begin</h2>
                        <div className="flex items-center gap-3">
                            <span className="font-ui text-[13px] text-parchment-400">
                                {rest.length} {rest.length === 1 ? 'adventure' : 'adventures'}
                            </span>
                            <ViewAllButton
                                count={templateAdventures.length}
                                label="View all adventures"
                                onClick={() => setPage('gallery-adventures')}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-5">
                        {rest.map((scene) => (
                            <SceneCard
                                key={scene.template.id}
                                scene={scene}
                                onBegin={() => handleTemplateStart(scene.template)}
                                onEdit={() => handleTemplateEdit(scene.template)}
                                onDelete={() => setPendingDelete(scene.template)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {hasInProgress && (
                <Shelf
                    title="Continue your journey"
                    subtitle={MODE_META.adventure.tagline}
                    icon={MODE_META.adventure.icon}
                    tone={MODE_META.adventure.tone}
                >
                    <InProgressList
                        adventures={inProgressAdventures}
                        layout="rail"
                        onEdit={handleInProgressEdit}
                        onPlay={handleInProgressEdit}
                        onDelete={deleteInProgress}
                    />
                </Shelf>
            )}

            {characterChats.length > 0 && (
                <Shelf
                    title="Recent chats"
                    subtitle={MODE_META.chat.tagline}
                    icon={MODE_META.chat.icon}
                    tone={MODE_META.chat.tone}
                >
                    <CharacterChatList
                        chats={characterChats}
                        layout="rail"
                        onResume={handleChatResume}
                        onDelete={deleteCharacterChat}
                    />
                </Shelf>
            )}

            {stories.length > 0 && (
                <Shelf
                    title="Your novels"
                    subtitle="Draft chapters from your cards and story codex."
                    icon={BookOpenText}
                    action={
                        <ViewAllButton
                            count={stories.length}
                            label="View all novels"
                            onClick={() => setPage('gallery-stories')}
                        />
                    }
                >
                    <StoryRail stories={stories} onOpen={handleStoryOpen} />
                </Shelf>
            )}

            {personaCards.length > 0 && (
                <Shelf
                    title="Your personas"
                    action={
                        <ViewAllButton
                            count={personaCards.length}
                            label="View all personas"
                            onClick={() => setPage('gallery-personas')}
                        />
                    }
                >
                    <CharacterList
                        characters={personaCards}
                        layout="rail"
                        onEdit={handleCharacterEdit}
                        onDelete={(index) => {
                            const character = personaCards[index]
                            if (character?.id) deleteCharacter(character.id)
                        }}
                    />
                </Shelf>
            )}

            {aiCharacters.length > 0 && (
                <Shelf
                    title="Your cast"
                    action={
                        <ViewAllButton
                            count={aiCharacters.length}
                            label="View all characters"
                            onClick={() => setPage('gallery-characters')}
                        />
                    }
                >
                    <CharacterList
                        characters={aiCharacters}
                        layout="rail"
                        onEdit={handleCharacterEdit}
                        onChat={handleCharacterChat}
                        onDelete={(index) => {
                            const character = aiCharacters[index]
                            if (character?.id) deleteCharacter(character.id)
                        }}
                    />
                </Shelf>
            )}

            {worlds.length > 0 && (
                <Shelf
                    title="Your worlds"
                    action={
                        <ViewAllButton
                            count={worlds.length}
                            label="View all worlds"
                            onClick={() => setPage('gallery-worlds')}
                        />
                    }
                >
                    <WorldList
                        worlds={worlds}
                        layout="rail"
                        onEdit={handleWorldEdit}
                        onDelete={(index) => {
                            const world = worlds[index]
                            if (world?.id) deleteWorld(world.id)
                        }}
                    />
                </Shelf>
            )}

            {items.length > 0 && (
                <Shelf
                    title="Your items"
                    action={
                        <ViewAllButton
                            count={items.length}
                            label="View all items"
                            onClick={() => setPage('gallery-items')}
                        />
                    }
                >
                    <ItemList
                        items={items}
                        layout="rail"
                        onEdit={handleItemEdit}
                        onDelete={(index) => {
                            const item = items[index]
                            if (item?.id) deleteItem(item.id)
                        }}
                    />
                </Shelf>
            )}

            <AccessMenu variant="compact" onAction={handleCreate} />

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

function storyChapters(story: Story) {
    return story.chapters ?? story.scenes ?? []
}

function storyWordCount(story: Story): number {
    return storyChapters(story)
        .map((chapter) => chapter.body)
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length
}

function storyContextTags(story: Story): string[] {
    return (story.activeCardRefs ?? [])
        .map((ref) => {
            const snapshot = ref.snapshot ?? {}
            return String(snapshot.name ?? snapshot.title ?? snapshot.alias ?? '').trim()
        })
        .filter(Boolean)
        .slice(0, 3)
}

function StoryRail({ stories, onOpen }: { stories: Story[]; onOpen: (story: Story) => void }) {
    return (
        <div className="flex flex-col gap-4 py-4">
            <CardGrid
                items={stories}
                layout="rail"
                getItemKey={(story) => story.id}
                showEmptyState={false}
                renderCard={(story) => {
                    const chapters = storyChapters(story)
                    const tags = storyContextTags(story)
                    const words = storyWordCount(story)

                    return (
                        <Card
                            key={story.id}
                            title={story.title}
                            subtitle={`${chapters.length || 1} chapter${chapters.length === 1 ? '' : 's'} · ${words} words`}
                            onClick={() => onOpen(story)}
                        >
                            <div className="flex flex-1 flex-col gap-3">
                                <p className="m-0 line-clamp-3 font-narrative text-sm leading-normal text-parchment-400">
                                    {story.description?.trim() ||
                                        chapters[0]?.body?.trim() ||
                                        'A novel draft ready for its next chapter.'}
                                </p>
                                {tags.length > 0 && (
                                    <div className="mt-auto flex flex-wrap gap-1.5">
                                        {tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded-full bg-parchment-50/[.06] px-2 py-1 font-ui text-[11px] font-semibold text-parchment-300"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )
                }}
            />
        </div>
    )
}

interface ShelfProps {
    title: string
    /** One-line mode descriptor under the title (e.g. "Game Master–led sessions"). */
    subtitle?: string
    icon?: LucideIcon
    tone?: 'ember' | 'arcane'
    /** Right-aligned affordance (e.g. a "View all" link to the full gallery). */
    action?: ReactNode
    children: ReactNode
}

function Shelf({ title, subtitle, icon, tone, action, children }: ShelfProps) {
    return (
        <section className="flex flex-col gap-1 border-t border-parchment-50/[.06] pt-6">
            <SectionHeader title={title} icon={icon} tone={tone} right={action} />
            {subtitle && <p className="m-0 font-ui text-[13px] text-parchment-400">{subtitle}</p>}
            {children}
        </section>
    )
}

interface ViewAllButtonProps {
    count: number
    label: string
    onClick: () => void
}

function ViewAllButton({ count, label, onClick }: ViewAllButtonProps) {
    return (
        <Button kind="ghost" size="sm" iconRight={<Icon icon={ArrowRight} size={14} />} onClick={onClick} aria-label={label}>
            View all ({count})
        </Button>
    )
}

function NoMatches({ onClear }: { onClear: () => void }) {
    return (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-parchment-50/[.12] bg-ink-800 p-12 text-center">
            <Icon icon={Sparkles} size={28} className="text-parchment-500" />
            <p className="font-narrative text-narrative text-parchment-300">No scenes match your search.</p>
            <Button kind="secondary" size="sm" onClick={onClear}>
                Clear filters
            </Button>
        </section>
    )
}
