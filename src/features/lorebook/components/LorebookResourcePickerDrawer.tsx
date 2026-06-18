import { useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { Lorebook } from '@/shared'
import { Badge, Button, Drawer, Icon, IconTile, Input, SelectionCheck, cx } from '@/ui/primitives'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card'
import { normalizeLorebook } from '../lorebookTransforms'
import { lorebookResourceCompletedExtraction, lorebookResourceIdsFromMetadata } from '../lorebookResources'
import { useLorebookResourceGallery } from '../hooks/useLorebookResourceGallery'

interface LorebookResourcePickerDrawerProps {
    open: boolean
    lorebook: Lorebook | null
    onClose: () => void
    onAttached: (lorebook: Lorebook) => void
}

export function LorebookResourcePickerDrawer({ open, lorebook, onClose, onAttached }: LorebookResourcePickerDrawerProps) {
    const { t } = useTranslation()
    const gallery = useLorebookResourceGallery(undefined, { enabled: open })
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const attachedIds = useMemo(() => new Set(lorebookResourceIdsFromMetadata(lorebook?.metadata)), [lorebook?.metadata])
    const { setQuery } = gallery

    useEffect(() => {
        if (!open) {
            setSelectedIds(new Set())
            setError(null)
            setQuery('')
        }
    }, [open, setQuery])

    const toggle = (id: string) => {
        if (attachedIds.has(id)) return
        setSelectedIds((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const attach = async () => {
        if (!lorebook?.id || selectedIds.size === 0 || busy) return
        setBusy(true)
        setError(null)
        try {
            let updated: Lorebook | null = null
            for (const resourceId of selectedIds) {
                updated = normalizeLorebook(await apiService.attachLorebookResource(lorebook.id, resourceId))
            }
            if (updated) onAttached(updated)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : t('lorebookResourcePicker.errors.attachFailed'))
        } finally {
            setBusy(false)
        }
    }

    const hasQuery = gallery.query.trim().length > 0

    return (
        <Drawer
            open={open}
            onClose={onClose}
            eyebrow={t('lorebookResourcePicker.eyebrow')}
            title={t('lorebookResourcePicker.title')}
            size="lg"
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={() => void attach()} disabled={busy || selectedIds.size === 0}>
                        {busy
                            ? t('lorebookResourcePicker.attaching')
                            : selectedIds.size > 0
                              ? t('lorebookResourcePicker.attachCount', { count: selectedIds.size })
                              : t('lorebookResourcePicker.attach')}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="m-0 font-ui text-xs text-parchment-400">
                    {t('lorebookResourcePicker.hint')}
                </p>
                <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3 text-parchment-400">
                        <Icon icon={Search} size={15} />
                    </span>
                    <Input
                        type="search"
                        value={gallery.query}
                        onChange={(event) => gallery.setQuery(event.target.value)}
                        placeholder={t('lorebookResourcePicker.searchPlaceholder')}
                        aria-label={t('lorebookResourcePicker.searchPlaceholder')}
                        className="pl-9"
                    />
                    {gallery.searching && (
                        <Loader2 size={15} className="absolute right-3 animate-spin text-ember-500" aria-hidden="true" />
                    )}
                </div>

                {(error || gallery.error) && (
                    <div className="rounded-md border border-blood-500/25 bg-blood-500/10 px-3 py-2 font-ui text-xs text-parchment-200" role="alert">
                        {error || gallery.error}
                    </div>
                )}

                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {gallery.loading ? (
                        <li className="flex items-center gap-2 px-2 py-4 font-ui text-xs text-parchment-400">
                            <Loader2 size={14} className="animate-spin text-ember-500" aria-hidden="true" />
                            {t('lorebookResourcePicker.loading')}
                        </li>
                    ) : gallery.items.length === 0 ? (
                        <li className="px-2 py-5 text-center font-ui text-xs text-parchment-500">
                            {hasQuery ? t('lorebookResourcePicker.noMatches') : t('lorebookResourcePicker.empty')}
                        </li>
                    ) : gallery.items.map((resource) => {
                        const attached = attachedIds.has(resource.id)
                        const selected = selectedIds.has(resource.id)
                        const extraction = lorebookResourceCompletedExtraction(resource)
                        return (
                            <li key={resource.id}>
                                <button
                                    type="button"
                                    onClick={() => toggle(resource.id)}
                                    disabled={attached}
                                    aria-pressed={selected}
                                    className={cx(
                                        'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                        attached
                                            ? 'cursor-default border-parchment-50/[.06] opacity-55'
                                            : selected
                                              ? `cursor-pointer ${SELECTED_CARD_CLASS}`
                                              : 'cursor-pointer border-parchment-50/10 hover:border-parchment-50/25 hover:bg-parchment-50/[.04]',
                                    )}
                                >
                                    <IconTile icon={FileText} tone="arcane" size="sm" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{resource.title || resource.fileName}</span>
                                        <span className="block truncate font-ui text-xs text-parchment-400">
                                            {extraction?.shortSummary || resource.description || resource.fileName}
                                        </span>
                                    </span>
                                    {attached ? (
                                        <Badge tone="arcane">{t('lorebookResourcePicker.attached')}</Badge>
                                    ) : (
                                        <SelectionCheck selected={selected} />
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>

                {gallery.hasMore && (
                    <Button variant="secondary" size="sm" onClick={gallery.loadMore} disabled={gallery.loadingMore}>
                        {gallery.loadingMore ? t('common.loading') : t('lorebookResourcePicker.loadMore')}
                    </Button>
                )}
            </div>
        </Drawer>
    )
}
