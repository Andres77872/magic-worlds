/**
 * LibraryShelf — "your library": one quiet, tabbed band in place of four
 * near-identical shelves. Chip tabs (with counts) switch a single compact
 * image-forward rail between personas, worlds, items, and novels; each tab
 * keeps its own create and view-all affordances. The only zone that keeps a
 * hairline divider — archive, not stage.
 */

import { useState } from 'react'
import { ArrowRight, BookOpenText, Gem, Globe, Pencil, Plus, Trash2, UserCircle, type LucideIcon } from 'lucide-react'
import type { Character, Item, Story, World } from '@/shared'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { CardGrid, GalleryCard, type CardOption } from '@/ui/components/lists/Card'
import { Button, Chip, Icon } from '@/ui/primitives'
import { itemCardProps, personaCardProps, worldCardProps, type LibraryCardProps } from './libraryCards'
import { StoryCard } from './StoryCard'
import { ZoneHeader } from './ZoneHeader'

/** A shelf teases; the galleries exhaust. */
const RAIL_CAP = 10

export type LibraryTab = 'personas' | 'worlds' | 'items' | 'novels'

const TAB_LABELS: Record<LibraryTab, string> = {
    personas: 'Personas',
    worlds: 'Worlds',
    items: 'Items',
    novels: 'Novels',
}

/** Same type icons the galleries and search groups use. */
const TAB_ICONS: Record<LibraryTab, LucideIcon> = {
    personas: UserCircle,
    worlds: Globe,
    items: Gem,
    novels: BookOpenText,
}

const TAB_EMPTY: Record<LibraryTab, { title: string; description: string; createLabel: string }> = {
    personas: {
        title: 'No personas yet',
        description: 'Create a persona and set it as your default player card.',
        createLabel: 'New persona',
    },
    worlds: {
        title: 'No worlds yet',
        description: 'Shape your first world and it will appear here.',
        createLabel: 'New world',
    },
    items: {
        title: 'No items yet',
        description: 'Create your first relic, tool, key, or object and it will appear here.',
        createLabel: 'New item',
    },
    novels: {
        title: 'No novels yet',
        description: 'Draft chapters from your cards and story codex.',
        createLabel: 'New novel',
    },
}

type PendingDelete =
    | { tab: 'personas'; entity: Character }
    | { tab: 'worlds'; entity: World }
    | { tab: 'items'; entity: Item }

export interface LibraryShelfProps {
    personas: Character[]
    worlds: World[]
    items: Item[]
    stories: Story[]
    onEditCharacter: (character: Character) => void
    onDeleteCharacter: (character: Character) => Promise<void> | void
    onEditWorld: (world: World) => void
    onDeleteWorld: (world: World) => Promise<void> | void
    onEditItem: (item: Item) => void
    onDeleteItem: (item: Item) => Promise<void> | void
    onOpenStory: (story: Story) => void
    onViewAll: (tab: LibraryTab) => void
    /** `undefined` for novels — drafts begin from cards, not from here. */
    onCreate: (tab: Exclude<LibraryTab, 'novels'>) => void
}

export function LibraryShelf({
    personas,
    worlds,
    items,
    stories,
    onEditCharacter,
    onDeleteCharacter,
    onEditWorld,
    onDeleteWorld,
    onEditItem,
    onDeleteItem,
    onOpenStory,
    onViewAll,
    onCreate,
}: LibraryShelfProps) {
    const counts: Record<LibraryTab, number> = {
        personas: personas.length,
        worlds: worlds.length,
        items: items.length,
        novels: stories.length,
    }
    const tabs: LibraryTab[] = ['personas', 'worlds', 'items', 'novels']
    // Default to the first tab with content at mount; after that the choice is the user's.
    const [tab, setTab] = useState<LibraryTab>(() => tabs.find((key) => counts[key] > 0) ?? 'personas')
    const [pending, setPending] = useState<PendingDelete | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const confirmDelete = async () => {
        const target = pending
        setPending(null)
        if (!target) return
        setDeletingId(target.entity.id)
        try {
            if (target.tab === 'personas') await onDeleteCharacter(target.entity)
            else if (target.tab === 'worlds') await onDeleteWorld(target.entity)
            else await onDeleteItem(target.entity)
        } finally {
            setDeletingId(null)
        }
    }

    const empty = TAB_EMPTY[tab]
    const activeCount = counts[tab]

    const editDeleteOptions = (onEdit: () => void, requestDelete: () => void): CardOption[] => [
        { type: 'custom', icon: <Icon icon={Pencil} size={15} />, label: 'Edit', onClick: onEdit },
        { type: 'custom', icon: <Icon icon={Trash2} size={15} />, label: 'Delete', onClick: requestDelete, danger: true },
    ]

    const renderRail = <T extends { id: string }>(
        entities: T[],
        toCard: (entity: T) => LibraryCardProps,
        onEdit: (entity: T) => void,
        requestDelete: (entity: T) => void,
    ) => (
        <CardGrid
            items={entities.slice(0, RAIL_CAP)}
            layout="rail"
            railWidth="compact"
            fadeEdges
            getItemKey={(entity) => entity.id}
            showEmptyState={false}
            renderCard={(entity) => (
                <GalleryCard
                    {...toCard(entity)}
                    size="compact"
                    options={editDeleteOptions(
                        () => onEdit(entity),
                        () => requestDelete(entity),
                    )}
                    onClick={() => onEdit(entity)}
                    actionLabel={`Edit ${toCard(entity).title}`}
                    deleting={deletingId === entity.id}
                />
            )}
        />
    )

    return (
        <section
            className="flex flex-col border-t border-parchment-50/[.06] pt-10"
            data-testid="library-shelf"
        >
            <ZoneHeader
                eyebrow="Your library"
                tone="muted"
                title="Everything you've made"
                right={
                    <>
                        {tab !== 'novels' && (
                            <Button kind="ghost" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={() => onCreate(tab)}>
                                {TAB_EMPTY[tab].createLabel}
                            </Button>
                        )}
                        <Button
                            kind="ghost"
                            size="sm"
                            iconRight={<Icon icon={ArrowRight} size={14} />}
                            onClick={() => onViewAll(tab)}
                            aria-label={`View all ${TAB_LABELS[tab].toLowerCase()}`}
                        >
                            View all ({activeCount})
                        </Button>
                    </>
                }
            />

            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Library">
                {tabs.map((key) => (
                    <Chip key={key} active={tab === key} onClick={() => setTab(key)}>
                        {TAB_LABELS[key]} · {counts[key]}
                    </Chip>
                ))}
            </div>

            {activeCount === 0 ? (
                <div className="mt-5">
                    <EmptyState
                        icon={<Icon icon={TAB_ICONS[tab]} size={32} />}
                        message={empty.title}
                        secondaryText={empty.description}
                    >
                        {tab !== 'novels' && (
                            <Button kind="primary" size="sm" iconLeft={<Icon icon={Plus} size={15} />} onClick={() => onCreate(tab)}>
                                {empty.createLabel}
                            </Button>
                        )}
                    </EmptyState>
                </div>
            ) : tab === 'personas' ? (
                renderRail(personas, personaCardProps, onEditCharacter, (entity) => setPending({ tab: 'personas', entity }))
            ) : tab === 'worlds' ? (
                renderRail(worlds, worldCardProps, onEditWorld, (entity) => setPending({ tab: 'worlds', entity }))
            ) : tab === 'items' ? (
                renderRail(items, itemCardProps, onEditItem, (entity) => setPending({ tab: 'items', entity }))
            ) : (
                <CardGrid
                    items={stories.slice(0, RAIL_CAP)}
                    layout="rail"
                    fadeEdges
                    getItemKey={(story) => story.id}
                    showEmptyState={false}
                    renderCard={(story) => <StoryCard story={story} onOpen={onOpenStory} />}
                />
            )}

            <ConfirmDialog
                visible={pending !== null}
                title={pending?.tab === 'worlds' ? 'Delete world' : pending?.tab === 'items' ? 'Delete item' : 'Delete persona'}
                message={
                    pending
                        ? `Delete "${'name' in pending.entity ? pending.entity.name : ''}"? This cannot be undone.`
                        : ''
                }
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setPending(null)}
            />
        </section>
    )
}
