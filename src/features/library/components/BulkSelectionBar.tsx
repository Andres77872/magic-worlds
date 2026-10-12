/**
 * The Library's bulk organization toolbar (document 08 "Bulk organization").
 * Distinct from the six-character group-chat selection: it organizes and
 * copies cards. Selection covers the loaded page ("Select this page"), never
 * an unlimited cross-page set. Remove from this collection never deletes a
 * card; Copy to workspace is disabled past the 20-card copy limit, with why.
 */
import { useTranslation } from 'react-i18next'
import { CheckSquare, Copy, FolderMinus, FolderPlus, X } from 'lucide-react'
import { MAX_COPY_CARDS } from '@/infrastructure/api/workspaceContract'
import { Button, Icon } from '@/ui/primitives'

interface BulkSelectionBarProps {
    count: number
    /** Cards loaded on this page (Select this page selects them all). */
    pageCount: number
    /** Inside a collection: offer Remove from this collection. */
    inCollection: boolean
    /** Archived workspace: organization is read-only, copying stays available. */
    readOnly?: boolean
    busy?: boolean
    onSelectPage: () => void
    onClear: () => void
    onDone: () => void
    onAddToCollection: () => void
    onRemoveFromCollection: () => void
    onCopyToWorkspace: () => void
}

export function BulkSelectionBar({
    count,
    pageCount,
    inCollection,
    readOnly = false,
    busy = false,
    onSelectPage,
    onClear,
    onDone,
    onAddToCollection,
    onRemoveFromCollection,
    onCopyToWorkspace,
}: BulkSelectionBarProps) {
    const { t } = useTranslation()
    const none = count === 0
    const overLimit = count > MAX_COPY_CARDS
    return (
        <div
            role="toolbar"
            aria-label={t('library.selection.toolbar')}
            className="sticky top-17 z-[10] flex flex-col gap-3 rounded-lg border border-ember-500/25 bg-ink-700/95 px-4 py-3 shadow-lg backdrop-blur lg:top-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-ui text-sm font-semibold text-parchment-50" aria-live="polite">
                        {t('library.selection.count', { count })}
                    </p>
                    <p className="mt-0.5 font-ui text-xs text-parchment-400">{t('library.selection.hint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" iconLeft={<Icon icon={CheckSquare} size={15} />} onClick={onSelectPage} disabled={pageCount === 0}>
                        {t('library.selection.selectPage')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClear} disabled={none}>{t('library.selection.clear')}</Button>
                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={X} size={15} />} onClick={onDone}>
                        {t('library.selection.done')}
                    </Button>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {!readOnly && (
                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={FolderPlus} size={15} />} onClick={onAddToCollection} disabled={none || busy}>
                        {t('library.selection.addToCollection')}
                    </Button>
                )}
                {!readOnly && inCollection && (
                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={FolderMinus} size={15} />} onClick={onRemoveFromCollection} disabled={none || busy}>
                        {t('library.selection.removeFromCollection')}
                    </Button>
                )}
                <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon icon={Copy} size={15} />}
                    onClick={onCopyToWorkspace}
                    disabled={none || overLimit || busy}
                    aria-describedby={overLimit ? 'library-copy-limit' : undefined}
                >
                    {t('library.selection.copyToWorkspace')}
                </Button>
                {overLimit && (
                    <span id="library-copy-limit" className="font-ui text-caption text-amber-500">
                        {t('library.selection.copyLimit', { max: MAX_COPY_CARDS })}
                    </span>
                )}
            </div>
        </div>
    )
}
