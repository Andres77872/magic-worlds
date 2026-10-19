import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * A collection as a compact folder entry in the Library browser (document 08
 * "Selected library browsing contract"): folder icon, the word Collection, its
 * name, optional description, and card count. Never a portrait-sized card.
 * Supports drag-and-drop card organization with Reverie candlelit drop-target
 * states (`ready`, `over`, `member`, `dropping`) and a compact `pill` variant
 * for the in-collection shelf.
 */
import type { DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Folder, FolderOpen, FolderPlus, Loader2 } from 'lucide-react'
import type { Collection } from '@/shared/types'
import { CardOptions, type CardOption } from '@/ui/components'
import { Badge, Icon, IconTile, cx } from '@/ui/primitives'
import { isLibraryCardCountAvailable } from '@/shared/featureFlags'

export type FolderDropState = 'idle' | 'ready' | 'over' | 'member' | 'dropping'

interface CollectionFolderProps {
    collection: Pick<Collection, 'id' | 'name' | 'description' | 'card_count'>
    /** `card` = compact tile (grid views); `row` = list view; `pill` = horizontal shelf chip. */
    view?: 'card' | 'row' | 'pill'
    /** Marks the currently open collection in the horizontal shelf. */
    active?: boolean
    /** Drag-and-drop target visual state. */
    dropState?: FolderDropState
    /** Contextual hint shown when a card is hovered over this folder during a drag. */
    dropLabel?: string
    onOpen: () => void
    /** Rename/delete; omitted when read-only. */
    options?: CardOption[]
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void
    onDragEnter?: (event: DragEvent<HTMLDivElement>) => void
    onDragLeave?: (event: DragEvent<HTMLDivElement>) => void
    onDrop?: (event: DragEvent<HTMLDivElement>) => void
}

export function CollectionFolder({
    collection,
    view = 'card',
    active = false,
    dropState = 'idle',
    dropLabel,
    onOpen,
    options = [],
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
}: CollectionFolderProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const count = t('library.folder.cardCount', { count: collection.card_count })
    const countAvailable = isLibraryCardCountAvailable()

    const dropStateClass =
        dropState === 'over'
            ? 'border-ember-500 bg-ember-500/15 shadow-glow-ember scale-[1.01]'
            : dropState === 'ready'
              ? 'border-dashed border-ember-500/45 bg-surface-raised/85'
              : dropState === 'member'
                ? 'border-line bg-surface-raised/45 opacity-80'
                : dropState === 'dropping'
                  ? 'border-ember-500/55 bg-ember-500/10'
                  : active
                    ? 'border-ember-500/55 bg-ember-500/10 ring-1 ring-ember-500/35'
                    : 'border-line bg-surface-raised/60 lift hover:border-ember-500/40 focus-within:border-ember-500/40'

    const tileIcon = dropState === 'over' ? FolderPlus : active ? FolderOpen : Folder

    if (view === 'pill') {
        return (
            <div
                data-collection-id={collection.id}
                data-drop-state={dropState}
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cx(
                    'group relative inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 transition-all',
                    dropStateClass,
                )}
            >
                <button
                    type="button"
                    onClick={onOpen}
                    aria-current={active ? 'page' : undefined}
                    aria-label={t('library.folder.open', { name: collection.name })}
                    title={collection.description ?? collection.name}
                    className="flex min-w-0 items-center gap-2 rounded-full text-left font-ui text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                >
                    {dropState === 'dropping' ? (
                        <Icon icon={Loader2} size={14} className="shrink-0 animate-spin text-ember-400 motion-reduce:animate-none" />
                    ) : (
                        <Icon icon={tileIcon} size={14} className={cx('shrink-0', active || dropState === 'over' ? 'text-ember-300' : 'text-ember-400')} />
                    )}
                    <span className={cx('max-w-40 truncate font-semibold', active ? 'text-ember-200' : 'text-fg')}>
                        {collection.name}
                    </span>
                    {countAvailable && (
                        <span className="shrink-0 font-mono text-micro text-fg-muted">
                            {collection.card_count}
                        </span>
                    )}
                    {dropState === 'over' && dropLabel && (
                        <Badge tone="ember" className="px-2 py-0.5 text-micro">
                            {dropLabel}
                        </Badge>
                    )}
                    {dropState === 'member' && (
                        <Badge tone="neutral" icon={<Icon icon={Check} size={10} />} className="px-2 py-0.5 text-micro">
                            {t('library.drag.alreadyIn')}
                        </Badge>
                    )}
                </button>
            </div>
        )
    }

    return (
        <div
            data-collection-id={collection.id}
            data-drop-state={dropState}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cx(
                'group relative flex items-center gap-2 rounded-lg border transition-all',
                dropStateClass,
                view === 'row' ? 'px-3 py-2.5' : 'px-3.5 py-3',
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                aria-label={t('library.folder.open', { name: collection.name })}
                title={collection.description ?? collection.name}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
            >
                {dropState === 'dropping' ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ember-500/15 text-ember-400">
                        <Icon icon={Loader2} size={16} className="animate-spin motion-reduce:animate-none" />
                    </span>
                ) : (
                    <IconTile icon={tileIcon} tone="ember" size="sm" glow className="shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-ui text-sm font-semibold text-fg">{collection.name}</span>
                        {dropState === 'over' && dropLabel && (
                            <Badge tone="ember" className="shrink-0 px-2 py-0.5 text-micro">
                                {dropLabel}
                            </Badge>
                        )}
                        {dropState === 'member' && (
                            <Badge tone="neutral" icon={<Icon icon={Check} size={10} />} className="shrink-0 px-2 py-0.5 text-micro">
                                {t('library.drag.alreadyIn')}
                            </Badge>
                        )}
                    </span>
                    <span className="block truncate font-ui text-caption text-fg-muted">
                        {t('library.folder.kind')}{countAvailable ? ` · ${count}` : ''}
                    </span>
                    {collection.description && (
                        <span className="mt-0.5 block truncate font-ui text-caption text-fg-faint">
                            {collection.description}
                        </span>
                    )}
                </span>
            </button>
            {options.length > 0 && (
                <CardOptions
                    options={options}
                    forceMenu
                    aria-label={t('library.folder.menu', { name: collection.name })}
                    className="shrink-0"
                    triggerTestId="collection-options-button"
                />
            )}
        </div>
    )
}
