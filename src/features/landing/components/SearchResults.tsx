/**
 * SearchResults — the dashboard's search state. While a query is active the
 * zone stack steps aside and everything that answers is shown grouped, each
 * group rendered with the card language its zone uses normally (resume rows,
 * portrait gallery cards, story tiles) so results stay recognizable.
 */

import { ArrowRight, BookOpenText, Gem, Globe, MessageCircle, Play, SearchX, Swords, UserCircle, Users, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Adventure, Character, Item, Story, World } from '@/shared'
import { MODE_META } from '@/shared/modes'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { GalleryCard } from '@/ui/components/lists/Card'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { CARD_GRID_CLASS, characterCardProps, itemCardProps, personaCardProps, sceneCardProps, worldCardProps, type LibraryCardProps } from './libraryCards'
import type { ResumeSession } from './resumeModel'
import { ResumeCard } from './ResumeCard'
import type { DashboardSearchGroup, DashboardSearchResults } from './searchModel'
import { StoryCard } from './StoryCard'

const GROUP_ICONS: Record<DashboardSearchGroup['key'], LucideIcon> = {
    sessions: Play,
    adventures: Swords,
    cast: Users,
    personas: UserCircle,
    worlds: Globe,
    items: Gem,
    novels: BookOpenText,
}

export interface SearchResultsProps {
    results: DashboardSearchResults
    onClear: () => void
    onOpenSession: (session: ResumeSession) => void
    onBeginTemplate: (template: Adventure) => void
    onChatCharacter: (character: Character) => void
    onEditCharacter: (character: Character) => void
    onEditWorld: (world: World) => void
    onEditItem: (item: Item) => void
    onOpenStory: (story: Story) => void
    onCreateAdventure: () => void
    /** Navigate to the gallery backing a group ("View all in gallery"). */
    onViewGallery: (key: DashboardSearchGroup['key']) => void
}

export function SearchResults({
    results,
    onClear,
    onOpenSession,
    onBeginTemplate,
    onChatCharacter,
    onEditCharacter,
    onEditWorld,
    onEditItem,
    onOpenStory,
    onCreateAdventure,
    onViewGallery,
}: SearchResultsProps) {
    const { t } = useTranslation()
    if (results.total === 0) {
        return (
            <EmptyState
                icon={<Icon icon={SearchX} size={40} />}
                message={t('landing.search.nothingMatches', { query: results.query })}
                secondaryText={t('landing.search.secondary')}
            >
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button kind="secondary" size="sm" onClick={onClear}>
                        {t('gallery.clearSearch')}
                    </Button>
                    <Button kind="primary" size="sm" iconLeft={<Icon icon={Wand2} size={15} />} onClick={onCreateAdventure}>
                        {t('landing.search.forgeAdventure')}
                    </Button>
                </div>
            </EmptyState>
        )
    }

    return (
        <div className="flex flex-col gap-10" data-testid="search-results">
            <h2 className="sr-only">{t('landing.search.resultsHeading')}</h2>
            {results.groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-4">
                    <SectionHeader
                        title={t('landing.search.groupHeading', { label: t(group.labelKey), count: group.total })}
                        icon={GROUP_ICONS[group.key]}
                        tone={group.key === 'cast' ? 'arcane' : 'ember'}
                        right={
                            group.key !== 'sessions' ? (
                                <Button
                                    kind="ghost"
                                    size="sm"
                                    iconRight={<Icon icon={ArrowRight} size={14} />}
                                    onClick={() => onViewGallery(group.key)}
                                >
                                    {t('landing.search.viewAllInGallery')}
                                </Button>
                            ) : undefined
                        }
                    />
                    {renderGroup(group, t, {
                        onOpenSession,
                        onBeginTemplate,
                        onChatCharacter,
                        onEditCharacter,
                        onEditWorld,
                        onEditItem,
                        onOpenStory,
                    })}
                </section>
            ))}
        </div>
    )
}

type GroupHandlers = Pick<
    SearchResultsProps,
    'onOpenSession' | 'onBeginTemplate' | 'onChatCharacter' | 'onEditCharacter' | 'onEditWorld' | 'onEditItem' | 'onOpenStory'
>

function cardGrid(children: React.ReactNode) {
    return <div className={CARD_GRID_CLASS}>{children}</div>
}

// Default size, not compact: these grids share their column widths with
// BeginZone and the gallery pages, so the card scale must match too.
function galleryCard(key: string, props: LibraryCardProps, onClick: () => void, actionLabel: string, footer?: React.ReactNode) {
    return (
        <GalleryCard
            key={key}
            {...props}
            onClick={onClick}
            actionLabel={actionLabel}
            footer={footer}
        />
    )
}

function renderGroup(group: DashboardSearchGroup, t: TFunction, handlers: GroupHandlers) {
    switch (group.key) {
        case 'sessions':
            return (
                <div className="grid gap-4 md:grid-cols-2">
                    {group.items.map((session) => (
                        <ResumeCard
                            key={`${session.kind}-${session.id}`}
                            session={session}
                            onContinue={() => handlers.onOpenSession(session)}
                        />
                    ))}
                </div>
            )
        case 'adventures':
            return cardGrid(
                group.items.map((scene) =>
                    galleryCard(
                        scene.template.id,
                        sceneCardProps(scene),
                        () => handlers.onBeginTemplate(scene.template),
                        `${MODE_META.adventure.beginLabel}: ${scene.title}`,
                    ),
                ),
            )
        case 'cast':
            return cardGrid(
                group.items.map((character) =>
                    galleryCard(
                        character.id,
                        characterCardProps(character),
                        () => handlers.onEditCharacter(character),
                        t('landing.rail.editAria', { name: character.name }),
                        <Button
                            kind="arcane"
                            size="sm"
                            full
                            iconLeft={<Icon icon={MessageCircle} size={15} />}
                            onClick={() => handlers.onChatCharacter(character)}
                        >
                            {t('landing.search.chat')}
                        </Button>,
                    ),
                ),
            )
        case 'personas':
            return cardGrid(
                group.items.map((character) =>
                    galleryCard(
                        character.id,
                        personaCardProps(character),
                        () => handlers.onEditCharacter(character),
                        t('landing.rail.editAria', { name: character.name }),
                    ),
                ),
            )
        case 'worlds':
            return cardGrid(
                group.items.map((world) =>
                    galleryCard(world.id, worldCardProps(world), () => handlers.onEditWorld(world), t('landing.rail.editAria', { name: world.name })),
                ),
            )
        case 'items':
            return cardGrid(
                group.items.map((item) =>
                    galleryCard(item.id, itemCardProps(item), () => handlers.onEditItem(item), t('landing.rail.editAria', { name: item.name })),
                ),
            )
        case 'novels':
            return (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 md:gap-5">
                    {group.items.map((story) => (
                        <StoryCard key={story.id} story={story} onOpen={handlers.onOpenStory} />
                    ))}
                </div>
            )
    }
}
