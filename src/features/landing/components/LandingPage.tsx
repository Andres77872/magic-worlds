/**
 * Landing — the discovery gallery. A time-of-day greeting + search, genre
 * filters, a featured scene, then a grid of scenes to begin. Below the gallery,
 * lightweight shelves keep in-progress journeys, characters, and worlds within
 * reach (each with its own edit / delete affordances).
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Globe, Sparkles, Users, Wand2 } from 'lucide-react'
import { useNavigation, useData, useAuth } from '@/app/hooks'
import type { Character, World, Adventure } from '@/shared'
import { CharacterList, WorldList, InProgressList } from '@/ui/components'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { Button, Eyebrow, Icon, SectionHeader } from '@/ui/primitives'
import { LandingLoading } from './LandingLoading'
import { GreetingHeader } from './GreetingHeader'
import { FilterChips } from './FilterChips'
import { FeaturedScene } from './FeaturedScene'
import { SceneCard } from './SceneCard'
import { toScene, sceneMatchesFilter, sceneMatchesQuery } from './sceneModel'

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

    if (isLoading) {
        return <LandingLoading />
    }

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
            <GreetingHeader query={query} onQueryChange={setQuery} />

            {genres.length > 0 && <FilterChips options={genres} active={filter} onChange={setFilter} />}

            {scenes.length === 0 ? (
                <EmptyHero
                    onCreateAdventure={() => requireAuth(() => setPage('adventure'))}
                    onCreateCharacter={() => requireAuth(() => setPage('character'))}
                    onCreateWorld={() => requireAuth(() => setPage('world'))}
                />
            ) : featured ? (
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
            )}

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

            {inProgressAdventures.length > 0 && (
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

interface EmptyHeroProps {
    onCreateAdventure: () => void
    onCreateCharacter: () => void
    onCreateWorld: () => void
}

function EmptyHero({ onCreateAdventure, onCreateCharacter, onCreateWorld }: EmptyHeroProps) {
    return (
        <section className="relative overflow-hidden rounded-2xl border border-parchment-50/[.08] bg-ink-700 p-8 shadow-lg sm:p-10">
            <Eyebrow tone="arcane">Begin your first tale</Eyebrow>
            <h2 className="mt-2 font-display text-[clamp(28px,3.5vw,42px)] font-semibold leading-[1.05] text-parchment-50">
                Your worlds await their first spark
            </h2>
            <p className="mt-3 max-w-[54ch] font-narrative text-narrative leading-relaxed text-parchment-200">
                Weave an adventure, craft a character, or build a world — then begin a scene and let the story unfold.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
                <Button kind="primary" iconLeft={<Icon icon={Wand2} size={16} />} onClick={onCreateAdventure}>
                    Create an adventure
                </Button>
                <Button kind="secondary" iconLeft={<Icon icon={Users} size={16} />} onClick={onCreateCharacter}>
                    New character
                </Button>
                <Button kind="secondary" iconLeft={<Icon icon={Globe} size={16} />} onClick={onCreateWorld}>
                    New world
                </Button>
            </div>
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
