/**
 * CodexLorebookPickerDrawer — two-step lorebook cloning: search lorebooks
 * (entries arrive inline with the list), then pick entries to clone. Each
 * picked entry becomes its own codex snapshot, individually mentionable and
 * editable; the source lorebook is never linked.
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookMarked, Check, Loader2, Search } from 'lucide-react'
import type { Lorebook } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { normalizeLorebookList } from '@/features/lorebook/lorebookTransforms'
import { Badge, Button, Drawer, Icon, IconButton, Tag, cx } from '@/ui/primitives'

const SEARCH_DEBOUNCE_MS = 300
const LOREBOOK_LIMIT = 24

interface CodexLorebookPickerDrawerProps {
    open: boolean
    busy: boolean
    /** Entry ids already cloned into the codex. */
    existingEntryIds: Set<string>
    onClose: () => void
    onClone: (lorebook: Lorebook, entryIds: string[]) => Promise<void>
}

export function CodexLorebookPickerDrawer({ open, busy, existingEntryIds, onClose, onClone }: CodexLorebookPickerDrawerProps) {
    const [query, setQuery] = useState('')
    const [lorebooks, setLorebooks] = useState<Lorebook[]>([])
    const [loading, setLoading] = useState(false)
    const [picked, setPicked] = useState<Lorebook | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const seqRef = useRef(0)

    useEffect(() => {
        if (!open) return
        const seq = ++seqRef.current
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true)
        const timer = setTimeout(() => {
            apiService
                .getLorebooks(0, LOREBOOK_LIMIT, query.trim() || undefined)
                .then((raw) => {
                    if (seq !== seqRef.current) return
                    setLorebooks(normalizeLorebookList(raw))
                })
                .catch(() => {
                    if (seq !== seqRef.current) return
                    setLorebooks([])
                })
                .finally(() => {
                    if (seq === seqRef.current) setLoading(false)
                })
        }, SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [open, query])

    const close = () => {
        setPicked(null)
        setSelectedIds(new Set())
        setQuery('')
        onClose()
    }

    const pickLorebook = (lorebook: Lorebook) => {
        setPicked(lorebook)
        // Default selection: enabled entries that are not already cloned.
        setSelectedIds(new Set(lorebook.entries.filter((entry) => entry.enabled && !existingEntryIds.has(entry.id)).map((entry) => entry.id)))
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
        await onClone(picked, Array.from(selectedIds))
        close()
    }

    return (
        <Drawer
            open={open}
            onClose={close}
            eyebrow="Codex"
            title={picked ? picked.name : 'Add a lorebook'}
            icon={<Icon icon={BookMarked} size={18} />}
            size="xl"
            footer={
                picked ? (
                    <div className="flex w-full items-center justify-between gap-2">
                        <Button
                            kind="ghost"
                            size="sm"
                            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(selectableIds))}
                            disabled={busy || selectableIds.length === 0}
                        >
                            {allSelected ? 'Select none' : 'Select all'}
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button kind="ghost" onClick={close} disabled={busy}>
                                Cancel
                            </Button>
                            <Button
                                kind="primary"
                                onClick={() => void submit()}
                                disabled={busy || selectedIds.size === 0}
                                data-testid="codex-clone-entries-submit"
                            >
                                {busy ? 'Cloning…' : `Clone ${selectedIds.size} ${selectedIds.size === 1 ? 'entry' : 'entries'}`}
                            </Button>
                        </div>
                    </div>
                ) : undefined
            }
        >
            {!picked ? (
                <div className="flex flex-col gap-3">
                    <p className="m-0 font-ui text-xs text-parchment-400">
                        Entries are copied into this novel — later lorebook edits won't affect it.
                    </p>
                    <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-3 text-parchment-400">
                            <Icon icon={Search} size={15} />
                        </span>
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your lorebooks…"
                            aria-label="Search your lorebooks"
                            className="w-full rounded-md border border-parchment-50/10 bg-ink-800 py-2 pl-9 pr-9 font-ui text-sm text-parchment-50 placeholder:text-parchment-500 focus:outline-none"
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
                                            <Badge tone="arcane">{lorebook.entries.length} entries</Badge>
                                        </span>
                                        {lorebook.description && (
                                            <span className="mt-0.5 block truncate font-ui text-xs text-parchment-400">{lorebook.description}</span>
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {lorebooks.length === 0 && !loading && (
                            <li className="px-2 py-4 text-center font-ui text-xs text-parchment-500">No lorebooks match.</li>
                        )}
                    </ul>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <IconButton label="Back to lorebooks" size="sm" onClick={() => setPicked(null)}>
                            <Icon icon={ArrowLeft} size={15} />
                        </IconButton>
                        <p className="m-0 font-ui text-xs text-parchment-400">
                            Pick the entries to clone into the codex. Already-cloned entries are marked.
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
                                        onClick={() => !inCodex && toggleEntry(entry.id)}
                                        disabled={inCodex}
                                        aria-pressed={isSelected}
                                        className={cx(
                                            'flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                                            inCodex
                                                ? 'cursor-default border-parchment-50/[.06] opacity-55'
                                                : isSelected
                                                  ? 'cursor-pointer border-arcane-500/45 bg-arcane-500/10'
                                                  : 'cursor-pointer border-parchment-50/10 hover:border-parchment-50/25 hover:bg-parchment-50/[.04]',
                                        )}
                                        data-testid="codex-lorebook-entry"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cx(
                                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                                isSelected
                                                    ? 'border-arcane-500 bg-arcane-500 text-ink-900'
                                                    : 'border-parchment-50/25 text-transparent',
                                            )}
                                        >
                                            <Icon icon={Check} size={13} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="truncate font-ui text-sm font-semibold text-parchment-100">
                                                    {entry.title || 'Untitled entry'}
                                                </span>
                                                <Tag className="shrink-0">{entry.entryType}</Tag>
                                                {inCodex && <Tag className="shrink-0">In codex</Tag>}
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
                            <li className="px-2 py-4 text-center font-ui text-xs text-parchment-500">This lorebook has no entries.</li>
                        )}
                    </ul>
                </div>
            )}
        </Drawer>
    )
}
