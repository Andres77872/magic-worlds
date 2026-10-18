import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
/**
 * CodexLorebookPickerDrawer — two-step lorebook cloning: search lorebooks
 * (entries arrive inline with the list), then pick entries to clone. Each
 * picked entry becomes its own codex snapshot, individually mentionable and
 * editable; the source lorebook is never linked.
 *
 * Workspace R1: lists the story's workspace (`workspaceId`, default the
 * committed one); a committed switch drops the list and selection and closes it.
 * While that workspace is archived (`readOnly`) lorebooks stay browsable, but
 * nothing can be picked or cloned.
 */
import { isLorebooksFeatureEnabled } from '@/shared/featureFlags'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, ArrowLeft, BookMarked, Loader2, Search } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { Lorebook } from '@/shared'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import { useWorkspaceSwitch } from '@/features/codex/hooks/useWorkspaceSwitch'
import { normalizeLorebookList } from '@/features/lorebook/lorebookTransforms'
import { SELECTED_CARD_CLASS } from '@/ui/components/lists/Card'
import { Badge, Button, Callout, Drawer, Icon, IconButton, Input, SelectionCheck, Tag, cx } from '@/ui/primitives'

const SEARCH_DEBOUNCE_MS = 300
const LOREBOOK_LIMIT = 24

interface CodexLorebookPickerDrawerProps {
    open: boolean
    /** The story's workspace (default: the committed workspace). */
    workspaceId?: string | null
    busy: boolean
    /** The story's workspace is archived: browse only, nothing is cloned. */
    readOnly?: boolean
    /** Entry ids already cloned into the codex. */
    existingEntryIds: Set<string>
    onClose: () => void
    onClone: (lorebook: Lorebook, entryIds: string[]) => Promise<void>
}

export function CodexLorebookPickerDrawer({ open, workspaceId, busy, readOnly = false, existingEntryIds, onClose, onClone }: CodexLorebookPickerDrawerProps) {
    const featureFlagGeneration = useFeatureFlags().generation
    const { t } = useTranslation()
    const api = useScopedApi(workspaceId)
    const { capture, isCurrent } = useWorkspace()
    const [query, setQuery] = useState('')
    const [lorebooks, setLorebooks] = useState<Lorebook[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [picked, setPicked] = useState<Lorebook | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const seqRef = useRef(0)

    useEffect(() => {
        if (!isLorebooksFeatureEnabled() || !open || !api) return
        const seq = ++seqRef.current
        const scope = capture()
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true)
        setError(null)
        const timer = setTimeout(() => {
            api
                .getLorebooks(0, LOREBOOK_LIMIT, query.trim() || undefined)
                .then((raw) => {
                    if (seq !== seqRef.current || !isCurrent(scope)) return
                    setLorebooks(normalizeLorebookList(raw))
                })
                .catch((cause: unknown) => {
                    if (seq !== seqRef.current || !isCurrent(scope)) return
                    setLorebooks([])
                    setError(cause instanceof Error ? cause.message : t('lorebookGallery.error.loadFailed'))
                })
                .finally(() => {
                    if (seq === seqRef.current && isCurrent(scope)) setLoading(false)
                })
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [api, capture, isCurrent, open, query, t, featureFlagGeneration])

    const reset = () => {
        setPicked(null)
        setSelectedIds(new Set())
        setQuery('')
    }

    const close = () => {
        reset()
        onClose()
    }

    // The listed lorebooks belong to the previous workspace: drop them and close.
    useWorkspaceSwitch(() => {
        seqRef.current += 1
        reset()
        setLorebooks([])
        setLoading(false)
        setError(null)
        if (open) onClose()
    })

    const pickLorebook = (lorebook: Lorebook) => {
        setPicked(lorebook)
        // Default selection: enabled entries that are not already cloned (none while read-only).
        setSelectedIds(readOnly ? new Set() : new Set(lorebook.entries.filter((entry) => entry.enabled && !existingEntryIds.has(entry.id)).map((entry) => entry.id)))
    }

    const toggleEntry = (entryId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(entryId)) next.delete(entryId)
            else next.add(entryId)
            return next
        })
    }

    const selectableIds = picked ? picked.entries.filter((entry) => !existingEntryIds.has(entry.id)).map((entry) => entry.id) : []
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))

    const submit = async () => {
        if (!picked) return
        if (readOnly) {
            setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
            return
        }
        const scope = capture()
        setError(null)
        try {
            await onClone(picked, Array.from(selectedIds))
            if (isCurrent(scope)) close()
        } catch (cause) {
            if (isCurrent(scope)) setError(cause instanceof Error ? cause.message : t('novelEditor.save.failed'))
        }
    }

    return (
        <Drawer
            open={open}
            onClose={close}
            eyebrow={t('novelEditor.codex.title')}
            title={picked ? picked.name : t('novelEditor.lorebookPicker.title')}
            icon={<Icon icon={BookMarked} size={18} />}
            size="xl"
            footer={
                picked ? (
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(selectableIds))}
                            disabled={busy || readOnly || selectableIds.length === 0}
                        >
                            {allSelected ? t('novelEditor.lorebookPicker.selectNone') : t('novelEditor.lorebookPicker.selectAll')}
                        </Button>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" onClick={close} disabled={busy}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => void submit()}
                                disabled={busy || readOnly || selectedIds.size === 0}
                                data-testid="codex-clone-entries-submit"
                            >
                                {busy ? t('novelEditor.lorebookPicker.cloning') : t('novelEditor.lorebookPicker.clone', { count: selectedIds.size })}
                            </Button>
                        </div>
                    </div>
                ) : undefined
            }
        >
            {readOnly && (
                <Callout tone="warning" role="status" icon={<Icon icon={Archive} size={16} />} className="mb-4" data-testid="codex-lorebook-archived">
                    {t(ARCHIVED_WORKSPACE_MESSAGE_KEY)}
                </Callout>
            )}
            {error && <Callout tone="danger" role="alert" className="mb-4">{error}</Callout>}
            {!picked ? (
                <div className="flex flex-col gap-3">
                    <p className="m-0 font-ui text-xs text-parchment-400">
                        {t('novelEditor.lorebookPicker.hint')}
                    </p>
                    <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-3 text-parchment-400">
                            <Icon icon={Search} size={15} />
                        </span>
                        <Input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('novelEditor.lorebookPicker.searchPlaceholder')}
                            aria-label={t('novelEditor.lorebookPicker.searchPlaceholder')}
                            className="pl-9 pr-9"
                            data-testid="codex-lorebook-search"
                        />
                        {loading && <Loader2 size={15} className="absolute right-3 animate-spin text-ember-500" aria-hidden="true" />}
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {lorebooks.map((lorebook) => (
                            <li key={lorebook.id}>
                                <button
                                    type="button"
                                    onClick={() => pickLorebook(lorebook)}
                                    className="flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-parchment-50/10 px-3 py-2.5 text-left transition-colors hover:border-parchment-50/25 hover:bg-parchment-50/[.04]"
                                    data-testid="codex-lorebook-option"
                                >
                                    <span className="mt-0.5 text-arcane-400">
                                        <Icon icon={BookMarked} size={16} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate font-ui text-sm font-semibold text-parchment-100">{lorebook.name}</span>
                                            <Badge tone="arcane">{t('novelEditor.lorebookPicker.entryCount', { count: lorebook.entries.length })}</Badge>
                                        </span>
                                        {lorebook.description && (
                                            <span className="mt-0.5 block truncate font-ui text-xs text-parchment-400">{lorebook.description}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {lorebooks.length === 0 && !loading && !error && (
                            <li className="px-2 py-4 text-center font-ui text-xs text-parchment-400">{t('novelEditor.lorebookPicker.noMatches')}</li>
                        )}
                    </ul>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <IconButton label={t('novelEditor.lorebookPicker.back')} size="sm" onClick={() => setPicked(null)}>
                            <Icon icon={ArrowLeft} size={15} />
                        </IconButton>
                        <p className="m-0 font-ui text-xs text-parchment-400">
                            {t('novelEditor.lorebookPicker.pickHint')}
                        </p>
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {picked.entries.map((entry) => {
                            const inCodex = existingEntryIds.has(entry.id)
                            const isSelected = selectedIds.has(entry.id)
                            return (
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        onClick={() => !inCodex && !readOnly && toggleEntry(entry.id)}
                                        disabled={inCodex || readOnly}
                                        aria-pressed={isSelected}
                                        className={cx(
                                            'flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                                            inCodex
                                                ? 'cursor-default border-parchment-50/[.06] opacity-55'
                                                : readOnly
                                                  ? 'cursor-default border-parchment-50/10'
                                                  : isSelected
                                                  ? `cursor-pointer ${SELECTED_CARD_CLASS}`
                                                  : 'cursor-pointer border-parchment-50/10 hover:border-parchment-50/25 hover:bg-parchment-50/[.04]',
                                        )}
                                        data-testid="codex-lorebook-entry"
                                    >
                                        <SelectionCheck selected={isSelected} className="mt-0.5" />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="truncate font-ui text-sm font-semibold text-parchment-100">
                                                    {entry.title || t('novelEditor.lorebookPicker.untitledEntry')}
                                                </span>
                                                <Tag className="shrink-0">{entry.entryType}</Tag>
                                                {inCodex && <Tag className="shrink-0">{t('novelEditor.codex.inCodex')}</Tag>}
                                            </span>
                                            {entry.content && (
                                                <span className="mt-0.5 block truncate font-ui text-xs text-parchment-400">
                                                    {entry.content.slice(0, 110)}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                        {picked.entries.length === 0 && (
                            <li className="px-2 py-4 text-center font-ui text-xs text-parchment-400">{t('novelEditor.lorebookPicker.noEntries')}</li>
                        )}
                    </ul>
                </div>
            )}
        </Drawer>
    )
}
