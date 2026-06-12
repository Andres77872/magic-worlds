/**
 * AddCardModal — pick library cards (characters or worlds) to clone into the
 * current adventure. Multi-select; on confirm the parent clones each picked card
 * into the adventure's snapshot. Only the adventure's copy is affected.
 */

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button, Icon, Input, Modal, Tag, cx } from '../../../ui/primitives'

export interface AddCandidate {
    id: string
    name: string
    badge?: string
    description?: string
}

interface AddCardModalProps {
    open: boolean
    title: string
    confirmNoun: string // e.g. "character" / "world"
    candidates: AddCandidate[]
    emptyHint: string
    /** Single-select (radio) instead of multi-select — used for the persona. */
    single?: boolean
    onClose: () => void
    onConfirm: (ids: string[]) => void | Promise<void>
}

export function AddCardModal({ open, title, confirmNoun, candidates, emptyHint, single, onClose, onConfirm }: AddCardModalProps) {
    const [selected, setSelected] = useState<string[]>([])
    const [query, setQuery] = useState('')
    const [busy, setBusy] = useState(false)

    // Reset transient state each time the modal opens (adjust-during-render, no effect).
    const [prevOpen, setPrevOpen] = useState(open)
    if (open !== prevOpen) {
        setPrevOpen(open)
        if (open) {
            setSelected([])
            setQuery('')
            setBusy(false)
        }
    }

    const toggle = (id: string) =>
        setSelected((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id)
            return single ? [id] : [...prev, id]
        })

    const q = query.trim().toLowerCase()
    const filtered = q
        ? candidates.filter((c) => `${c.name} ${c.badge ?? ''} ${c.description ?? ''}`.toLowerCase().includes(q))
        : candidates

    const confirm = async () => {
        if (selected.length === 0) return
        setBusy(true)
        try {
            await onConfirm(selected)
            onClose()
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            size="md"
            footer={
                <>
                    <Button kind="ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        kind="primary"
                        iconLeft={<Icon icon={Plus} size={16} />}
                        onClick={confirm}
                        disabled={busy || selected.length === 0}
                    >
                        {busy
                            ? 'Saving…'
                            : single
                              ? `Choose ${confirmNoun}`
                              : selected.length
                                ? `Add ${selected.length} ${confirmNoun}${selected.length === 1 ? '' : 's'}`
                                : `Add ${confirmNoun}s`}
                    </Button>
                </>
            }
        >
            {candidates.length === 0 ? (
                <p className="py-4 text-center font-narrative text-[14px] italic text-parchment-400">{emptyHint}</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {candidates.length > 8 && (
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search ${confirmNoun}s…`}
                        />
                    )}
                    <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
                        {filtered.map((c) => {
                            const isSelected = selected.includes(c.id)
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggle(c.id)}
                                    aria-pressed={isSelected}
                                    className={cx(
                                        'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                                        isSelected
                                            ? 'border-ember-500/50 bg-ember-500/[0.08]'
                                            : 'border-parchment-50/10 bg-ink-800 hover:border-parchment-50/20',
                                    )}
                                >
                                    <span
                                        className={cx(
                                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                                            isSelected ? 'border-ember-500 bg-ember-500 text-on-ember' : 'border-parchment-50/25',
                                        )}
                                    >
                                        {isSelected && <Check size={13} strokeWidth={2.5} />}
                                    </span>
                                    <span className="min-w-0 flex flex-col gap-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="font-display text-[16px] font-semibold leading-tight text-parchment-50">
                                                {c.name || 'Untitled'}
                                            </span>
                                            {c.badge && <Tag>{c.badge}</Tag>}
                                        </span>
                                        {c.description && (
                                            <span className="line-clamp-2 font-narrative text-[13px] leading-snug text-parchment-400">
                                                {c.description}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            )
                        })}
                        {filtered.length === 0 && (
                            <p className="px-1 py-3 text-center font-narrative text-sm italic text-parchment-400">
                                No {confirmNoun}s match “{query}”.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    )
}
