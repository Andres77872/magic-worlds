import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * A collection as a compact folder entry in the Library browser (document 08
 * "Selected library browsing contract"): folder icon, the word Collection, its
 * name and card count. Never a portrait-sized card. The main button opens it
 * (click/tap, Enter or Space); the menu holds rename/delete.
 */
import { useTranslation } from 'react-i18next'
import { Folder } from 'lucide-react'
import type { Collection } from '@/shared/types'
import { CardOptions, type CardOption } from '@/ui/components'
import { IconTile, cx } from '@/ui/primitives'
import { isLibraryCardCountAvailable } from '@/shared/featureFlags'

interface CollectionFolderProps {
    collection: Pick<Collection, 'id' | 'name' | 'description' | 'card_count'>
    /** `card` = compact tile (grid views); `row` = list view. */
    view?: 'card' | 'row'
    onOpen: () => void
    /** Rename/delete; omitted when read-only. */
    options?: CardOption[]
}

export function CollectionFolder({ collection, view = 'card', onOpen, options = [] }: CollectionFolderProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const count = t('library.folder.cardCount', { count: collection.card_count })
    return (
        <div
            data-collection-id={collection.id}
            className={cx(
                'group relative flex items-center gap-2 rounded-lg border border-line bg-surface-raised/60 transition-colors hover:border-ember-500/40 focus-within:border-ember-500/40',
                view === 'row' ? 'px-3 py-2' : 'px-3 py-3',
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                aria-label={t('library.folder.open', { name: collection.name })}
                title={collection.description ?? collection.name}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
            >
                <IconTile icon={Folder} tone="ember" size="sm" glow className="shrink-0" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-sm font-semibold text-fg">{collection.name}</span>
                    <span className="block truncate font-ui text-caption text-fg-muted">
                        {t('library.folder.kind')}{isLibraryCardCountAvailable() ? ` · ${count}` : ''}
                    </span>
                    {view === 'row' && collection.description && (
                        <span className="block truncate font-ui text-caption text-fg-faint">{collection.description}</span>
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
