/**
 * Add to collection: choose one or more collections of this workspace for the
 * selected cards. Adding is a membership set operation — the cards stay in the
 * library and can belong to several collections; nothing is moved.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, FolderPlus, Loader2 } from 'lucide-react'
import type { Collection } from '@/shared/types'
import { Button, Callout, Icon, Modal, SelectionCheck, cx } from '@/ui/primitives'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card/cardStyles'
import { isLibraryCardCountAvailable } from '@/shared/featureFlags'

interface CollectionPickerDialogProps {
    open: boolean
    collections: readonly Collection[]
    loading?: boolean
    cardCount: number
    /** A collection to leave out (the folder the cards are being viewed in). */
    excludeId?: string | null
    onClose: () => void
    onCreateCollection: () => void
    /** Resolves null on success, else the message to show. */
    onConfirm: (collectionIds: string[]) => Promise<string | null>
}

export function CollectionPickerDialog({
    open,
    collections,
    loading = false,
    cardCount,
    excludeId = null,
    onClose,
    onCreateCollection,
    onConfirm,
}: CollectionPickerDialogProps) {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [wasOpen, setWasOpen] = useState(open)
    if (wasOpen !== open) {
        setWasOpen(open)
        if (open) {
            setSelected(new Set())
            setError(null)
            setSaving(false)
        }
    }

    const choices = collections.filter((collection) => collection.id !== excludeId)
    const toggle = (id: string) => setSelected((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    })

    const confirm = async () => {
        if (selected.size === 0 || saving) return
        setSaving(true)
        setError(null)
        const message = await onConfirm([...selected])
        setSaving(false)
        if (message) setError(message)
    }

    return (
        <Modal
            open={open}
            onClose={saving ? () => {} : onClose}
            title={t('library.picker.title')}
            icon={<Icon icon={Folder} size={22} className="text-ember-400" />}
            footer={
                <>
                    <Button variant="ghost" iconLeft={<FolderPlus size={15} />} onClick={onCreateCollection} disabled={saving} className="mr-auto">
                        {t('library.picker.create')}
                    </Button>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={() => void confirm()} disabled={saving || selected.size === 0}>
                        {saving ? t('library.picker.adding') : t('library.picker.add')}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="font-ui text-sm text-fg-muted">{t('library.picker.description', { count: cardCount })}</p>
                {error && <Callout tone="danger" role="alert">{error}</Callout>}
                {loading && choices.length === 0 ? (
                    <p role="status" className="flex items-center gap-2 font-ui text-sm text-fg-muted">
                        <Icon icon={Loader2} size={15} className="animate-spin motion-reduce:animate-none" />
                        {t('library.picker.loading')}
                    </p>
                ) : choices.length === 0 ? (
                    <p className="font-ui text-sm text-fg-muted">{t('library.picker.empty')}</p>
                ) : (
                    <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto" aria-label={t('library.picker.title')}>
                        {choices.map((collection) => {
                            const isSelected = selected.has(collection.id)
                            return (
                                <li key={collection.id}>
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => toggle(collection.id)}
                                        className={cx(
                                            'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left font-ui text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500',
                                            isSelected ? SELECTED_CARD_CLASS : 'border-line hover:border-line-strong',
                                        )}
                                    >
                                        <Icon icon={Folder} size={16} className="shrink-0 text-ember-400" />
                                        <span className="min-w-0 flex-1 truncate font-semibold text-fg">{collection.name}</span>
                                        <span className="shrink-0 text-caption text-fg-muted">
                                            {isLibraryCardCountAvailable() && t('library.folder.cardCount', { count: collection.card_count })}
                                        </span>
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                            <SelectionCheck selected={isSelected} />
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </Modal>
    )
}
