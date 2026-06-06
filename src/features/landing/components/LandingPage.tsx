/**
 * Landing — an adaptive front door.
 *
 * Guests and fresh accounts get the marketing experience: a hero, a prominent
 * create menu, a "how it works" explainer, a row of sample worlds, and a closing
 * invitation. Returning users with content get their personalised dashboard:
 * greeting + search, the discovery gallery, and shelves for in-progress journeys,
 * characters, and worlds — plus a compact create strip.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Feather, Play, Sparkles, Users, Wand2 } from 'lucide-react'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import type { Character, World, Adventure } from '@/shared'
import { CharacterList, WorldList, InProgressList } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { LandingLoading } from './LandingLoading'
import { GreetingHeader } from './GreetingHeader'
import { FilterChips } from './FilterChips'
import { FeaturedScene } from './FeaturedScene'
import { SceneCard } from './SceneCard'
import { LandingHero, type HeroCta } from './LandingHero'
import { AccessMenu } from './AccessMenu'
import { HowItWorksSection } from './HowItWorksSection'
import { ShowcaseWorlds } from './ShowcaseWorlds'
import { ClosingCTA } from './ClosingCTA'
import { toScene, sceneTitle, sceneMatchesFilter, sceneMatchesQuery } from './sceneModel'
import { HERO_COPY, latestInProgress, type CreateAction } from './landingContent'

export function LandingPage() {
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        characters,
        worlds,
        templateAdventures,
        inProgressAdventures,
        isLoading,
        editCharacter,
        deleteCharacter,
        editWorld,
        deleteWorld,
        editTemplate,
        startTemplate,
        deleteTemplate,
        editInProgress,
        deleteInProgress,
    } = useData()

    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('All')
    const [pendingDelete, setPendingDelete] = useState<Adventure | null>(null)
    const showcaseRef = useRef<HTMLElement>(null)

    // Every action that mutates or starts requires auth — open the modal if not.
    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const handleTemplateStart = (t: Adventure) => requireAuth(() => { startTemplate(t); setPage('interaction') })
    const handleTemplateEdit = (t: Adventure) => requireAuth(() => { editTemplate(t); setPage('adventure') })
    const handleCharacterEdit = (c: Character) => requireAuth(() => { editCharacter(c); setPage('character') })
    const handleWorldEdit = (w: World) => requireAuth(() => { editWorld(w); setPage('world') })
    const handleInProgressEdit = (a: Adventure) => requireAuth(() => { editInProgress(a); setPage('interaction') })

    const createAdventure = () => requireAuth(() => setPage('adventure'))
    const createCharacter = () => requireAuth(() => setPage('character'))
    const createWorld = () => requireAuth(() => setPage('world'))
    const handleCreate = (key: CreateAction['key']) => {
        if (key === 'character') createCharacter()
        else if (key === 'world') createWorld()
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

    // Genre chips reflect the tags actually present across the user's scenes.
    const genres = useMemo(() => {
        const byKey = new Map<string, string>()
        scenes.forEach((scene) =>
            scene.tags.forEach((tag) => {
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
    const hasContent = hasScenes || hasInProgress || characters.length > 0 || worlds.length > 0
    const mode: 'guest' | 'returning' = isAuthenticated && hasContent ? 'returning' : 'guest'

    const resumeLatest = () =>
        requireAuth(() => {
            if (!latest) return
            editInProgress(latest)
            setPage('interaction')
        })

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
            : { label: 'Begin a scene', icon: Feather, onClick: createAdventure }
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
                        actionLabel="Begin a scene"
                        onAction={() => handleTemplateStart(featured.template)}
                    />
                ) : (
                    <NoMatches onClear={() => { setQuery(''); setFilter('All') }} />
                ))}

            {rest.length > 0 && (
                <section className="flex flex-col gap-5">
                    <div className="flex items-end justify-between gap-4">
                        <h2 className="font-display text-h3 font-semibold text-parchment-50">More worlds to wander</h2>
                        <span className="font-ui text-[13px] text-parchment-400">
                            {rest.length} {rest.length === 1 ? 'scene' : 'scenes'}
                        </span>
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
                <Shelf title="Continue your journey">
                    <InProgressList
                        adventures={inProgressAdventures}
                        onEdit={handleInProgressEdit}
                        onPlay={handleInProgressEdit}
                        onDelete={deleteInProgress}
                    />
                </Shelf>
            )}

            {characters.length > 0 && (
                <Shelf title="Your cast">
                    <CharacterList
                        characters={characters}
                        onEdit={handleCharacterEdit}
                        onDelete={(index) => {
                            const character = characters[index]
                            if (character?.id) deleteCharacter(character.id)
                        }}
                    />
                </Shelf>
            )}

            {worlds.length > 0 && (
                <Shelf title="Your worlds">
                    <WorldList
                        worlds={worlds}
                        onEdit={handleWorldEdit}
                        onDelete={(index) => {
                            const world = worlds[index]
                            if (world?.id) deleteWorld(world.id)
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
        </div>
    )
}

interface ShelfProps {
    title: string
    children: ReactNode
}

function Shelf({ title, children }: ShelfProps) {
    return (
        <section className="flex flex-col gap-1 border-t border-parchment-50/[.06] pt-6">
            <SectionHeader title={title} />
            {children}
        </section>
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
