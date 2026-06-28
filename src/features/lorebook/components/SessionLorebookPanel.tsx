import { useEffect, useMemo, useState } from 'react'
import { BookOpenText, Link2, Loader2, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useData, useFloatingWindows } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import { lorebookWindow } from '@/features/floatingWindows'
import type { Lorebook, LorebookAttachment, LorebookTargetKind } from '@/shared'
import { ReferenceEmpty, ReferenceGroup, ReferenceRow } from '@/ui/components'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card'
import { Badge, Button, Drawer, Icon, IconButton, IconTile, Input, SelectionCheck, cx } from '@/ui/primitives'
import { normalizeLorebookAttachment } from '../lorebookTransforms'
import { lorebookResourceSearchText, lorebookResourceStats, lorebookResourcesFromMetadata } from '../lorebookResources'

type SessionLorebookTargetKind = Extract<LorebookTargetKind, 'character_chat' | 'adventure_session'>

interface SessionLorebookPanelProps {
    targetKind: SessionLorebookTargetKind
    targetId: string
    label?: string
    className?: string
    /**
     * Draw the bordered card shell. Defaults to true so the panel stands alone
     * (e.g. the adventure left panel). The chat sidebar passes `false` because
     * its consolidated shell already frames the codex + lorebook groups.
     */
    framed?: boolean
}

function upsertAttachment(list: LorebookAttachment[], attachment: LorebookAttachment): LorebookAttachment[] {
    return [attachment, ...list.filter((item) => item.id !== attachment.id)]
}

function removeAttachment(list: LorebookAttachment[], attachmentId: string): LorebookAttachment[] {
    return list.filter((item) => item.id !== attachmentId)
}

function lorebookMatches(lorebook: Lorebook, query: string): boolean {
    if (!query) return true
    const haystack = [
        lorebook.name,
        lorebook.description ?? '',
        ...lorebook.tags,
        ...lorebook.entries.flatMap((entry) => [entry.title, ...entry.keys, ...entry.secondaryKeys]),
        lorebookResourceSearchText(lorebook),
    ].join(' ').toLowerCase()
    return haystack.includes(query)
}

export function SessionLorebookPanel({ targetKind, targetId, label, className, framed = true }: SessionLorebookPanelProps) {
    const { t } = useTranslation()
    const { lorebooks, setLorebooks } = useData()
    const { openWindow } = useFloatingWindows()
    const [attachments, setAttachments] = useState<LorebookAttachment[]>([])
    const [loading, setLoading] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const normalizedTargetId = targetId.trim()

    useEffect(() => {
        if (!normalizedTargetId) {
            setAttachments([])
            return
        }
        let mounted = true
        setLoading(true)
        setError(null)
        void apiService.listLorebookAttachments(targetKind, normalizedTargetId)
            .then((rows) => {
                if (mounted) setAttachments(rows.map(normalizeLorebookAttachment))
            })
            .catch((err) => {
                if (mounted) setError(err instanceof Error ? err.message : t('sessionLorebooks.errors.loadFailed'))
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })
        return () => {
            mounted = false
        }
    }, [normalizedTargetId, targetKind, t])

    const lorebookById = useMemo(() => new Map(lorebooks.map((book) => [book.id, book])), [lorebooks])
    const attachedLorebookIds = useMemo(() => new Set(attachments.map((attachment) => attachment.lorebookId)), [attachments])
    const filteredLorebooks = useMemo(() => {
        const q = query.trim().toLowerCase()
        return lorebooks.filter((lorebook) => lorebookMatches(lorebook, q))
    }, [lorebooks, query])

    const closePicker = () => {
        setPickerOpen(false)
        setQuery('')
        setSelectedIds(new Set<string>())
    }

    const toggleSelection = (lorebookId: string) => {
        if (attachedLorebookIds.has(lorebookId)) return
        setSelectedIds((current) => {
            const next = new Set(current)
            if (next.has(lorebookId)) next.delete(lorebookId)
            else next.add(lorebookId)
            return next
        })
    }

    const syncLorebooksWithAdded = (created: LorebookAttachment[]) => {
        if (created.length === 0) return
        setLorebooks(lorebooks.map((book) => {
            const nextForBook = created.filter((attachment) => attachment.lorebookId === book.id)
            if (nextForBook.length === 0) return book
            return {
                ...book,
                attachments: nextForBook.reduce(upsertAttachment, book.attachments),
            }
        }))
    }

    const syncLorebooksWithRemoved = (attachment: LorebookAttachment) => {
        setLorebooks(lorebooks.map((book) => (
            book.id === attachment.lorebookId
                ? { ...book, attachments: removeAttachment(book.attachments, attachment.id) }
                : book
        )))
    }

    const attachSelected = async () => {
        if (!normalizedTargetId || selectedIds.size === 0 || busyId) return
        setBusyId('add')
        setError(null)
        try {
            const created: LorebookAttachment[] = []
            for (const lorebookId of selectedIds) {
                const raw = await apiService.putLorebookAttachment({
                    lorebookId,
                    targetKind,
                    targetId: normalizedTargetId,
                    mode: 'linked',
                    snapshot: null,
                })
                created.push(normalizeLorebookAttachment(raw))
            }
            setAttachments((current) => created.reduce(upsertAttachment, current))
            syncLorebooksWithAdded(created)
            closePicker()
        } catch (err) {
            setError(err instanceof Error ? err.message : t('sessionLorebooks.errors.attachFailed'))
        } finally {
            setBusyId(null)
        }
    }

    const deleteAttachment = async (attachment: LorebookAttachment) => {
        if (busyId) return
        setBusyId(attachment.id)
        setError(null)
        try {
            await apiService.deleteLorebookAttachment(attachment.id)
            setAttachments((current) => removeAttachment(current, attachment.id))
            syncLorebooksWithRemoved(attachment)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('sessionLorebooks.errors.removeFailed'))
        } finally {
            setBusyId(null)
        }
    }

    const title = label ?? t('sessionLorebooks.title')

    const group = (
        <ReferenceGroup
            label={title}
            tone="arcane"
            count={attachments.length}
            onAdd={() => setPickerOpen(true)}
            addLabel={t('sessionLorebooks.add')}
            addDisabled={busyId !== null || !normalizedTargetId}
        >
            {error && (
                <div className="rounded-md border border-blood-500/25 bg-blood-500/10 px-2.5 py-1.5 font-ui text-xs text-parchment-200" role="alert">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 px-0.5 py-1 font-ui text-xs text-parchment-400">
                    <Loader2 size={14} className="animate-spin text-ember-500" aria-hidden="true" />
                    {t('sessionLorebooks.loading')}
                </div>
            ) : attachments.length === 0 ? (
                <ReferenceEmpty>{t('sessionLorebooks.emptyDescription')}</ReferenceEmpty>
            ) : (
                <div className="flex flex-col gap-1">
                    {attachments.map((attachment) => {
                        const lorebook = lorebookById.get(attachment.lorebookId)
                        const name = lorebook?.name ?? t('sessionLorebooks.unknownLorebook')
                        return (
                            <ReferenceRow
                                key={attachment.id}
                                testId="session-lorebook-attachment"
                                leading={<IconTile icon={BookOpenText} tone="arcane" size="sm" />}
                                title={name}
                                description={lorebook?.description || t('sessionLorebooks.linkedDescription')}
                                onTitleClick={lorebook ? () => openWindow(lorebookWindow(lorebook)) : undefined}
                                titleAriaLabel={t('sessionLorebooks.open', { name })}
                                trailing={
                                    <>
                                        <Badge tone="arcane" icon={<Icon icon={Link2} size={11} />}>{t('sessionLorebooks.linked')}</Badge>
                                        <IconButton
                                            label={t('sessionLorebooks.removeAria', { name })}
                                            size="sm"
                                            tone="danger"
                                            onClick={() => void deleteAttachment(attachment)}
                                            disabled={busyId !== null}
                                        >
                                            {busyId === attachment.id ? <Loader2 size={14} className="animate-spin" /> : <Icon icon={Trash2} size={14} />}
                                        </IconButton>
                                    </>
                                }
                            />
                        )
                    })}
                </div>
            )}
        </ReferenceGroup>
    )

    return (
        <>
            {framed ? (
                <div className={cx('rounded-lg border border-parchment-50/10 bg-ink-800 px-4 py-3', className)}>{group}</div>
            ) : className ? (
                <div className={className}>{group}</div>
            ) : (
                group
            )}

            <Drawer
                open={pickerOpen}
                onClose={closePicker}
                eyebrow={t('sessionLorebooks.drawerEyebrow')}
                title={t('sessionLorebooks.drawerTitle')}
                size="lg"
                footer={
                    <div className="flex w-full items-center justify-end gap-2">
                        <Button variant="ghost" onClick={closePicker} disabled={busyId === 'add'}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => void attachSelected()}
                            disabled={busyId === 'add' || selectedIds.size === 0}
                            data-testid="session-lorebook-add-submit"
                        >
                            {busyId === 'add'
                                ? t('sessionLorebooks.adding')
                                : selectedIds.size > 0
                                  ? t('sessionLorebooks.addCount', { count: selectedIds.size })
                                  : t('sessionLorebooks.add')}
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-3">
                    <p className="m-0 font-ui text-xs text-parchment-400">{t('sessionLorebooks.drawerHint')}</p>
                    <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-3 text-parchment-400">
                            <Icon icon={Search} size={15} />
                        </span>
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('sessionLorebooks.searchPlaceholder')}
                            aria-label={t('sessionLorebooks.searchPlaceholder')}
                            className="pl-9"
                            data-testid="session-lorebook-search"
                        />
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {filteredLorebooks.map((lorebook) => {
                            const inSession = attachedLorebookIds.has(lorebook.id)
                            const selected = selectedIds.has(lorebook.id)
                            const resourceStats = lorebookResourceStats(lorebookResourcesFromMetadata(lorebook.metadata))
                            return (
                                <li key={lorebook.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggleSelection(lorebook.id)}
                                        disabled={inSession}
                                        aria-pressed={selected}
                                        className={cx(
                                            'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                            inSession
                                                ? 'cursor-default border-parchment-50/[.06] opacity-55'
                                                : selected
                                                  ? `cursor-pointer ${SELECTED_CARD_CLASS}`
                                                  : 'cursor-pointer border-parchment-50/10 hover:border-parchment-50/25 hover:bg-parchment-50/[.04]',
                                        )}
                                        data-testid="session-lorebook-option"
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-800 text-arcane-300">
                                            <Icon icon={BookOpenText} size={14} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-ui text-sm font-semibold text-parchment-100">{lorebook.name}</span>
                                            <span className="block truncate font-ui text-xs text-parchment-400">
                                                {t('sessionLorebooks.entryResourceCount', { entries: lorebook.entries.length, resources: resourceStats.total })}
                                            </span>
                                        </span>
                                        {inSession ? (
                                            <Badge tone="arcane">{t('sessionLorebooks.inSession')}</Badge>
                                        ) : (
                                            <SelectionCheck selected={selected} />
                                        )}
                                    </button>
                                </li>
                            )
                        })}
                        {filteredLorebooks.length === 0 && (
                            <li className="px-2 py-4 text-center font-ui text-xs text-parchment-500">
                                {lorebooks.length === 0 ? t('sessionLorebooks.noLorebooks') : t('sessionLorebooks.noMatches')}
                            </li>
                        )}
                    </ul>
                </div>
            </Drawer>
        </>
    )
}
