/**
 * CodexEntryDrawer — view/edit one cloned snapshot (name + content). Edits
 * merge into the ref's snapshot only: the source card or lorebook entry is
 * never touched.
 */

import { useEffect, useState } from 'react'
import { Icon, Button, Drawer, Field, Input, Tag, Textarea } from '@/ui/primitives'
import type { CodexEntry } from '../../hooks/useCodex'
import { KIND_ICONS, KIND_META } from '../../utils/codexUtils'

interface CodexEntryDrawerProps {
    entry: CodexEntry | null
    busy: boolean
    onClose: () => void
    onSave: (entry: CodexEntry, patch: { label: string; description: string }) => Promise<void>
}

export function CodexEntryDrawer({ entry, busy, onClose, onSave }: CodexEntryDrawerProps) {
    const [label, setLabel] = useState('')
    const [description, setDescription] = useState('')

    const entryId = entry?.id ?? null
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLabel(entry?.label ?? '')
        setDescription(entry?.description ?? '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entryId])

    const meta = entry ? KIND_META.find((item) => item.kind === entry.kind) : null
    const keys = Array.isArray(entry?.ref.snapshot?.keys) ? (entry.ref.snapshot.keys as unknown[]).map(String) : []
    const sourceLorebookName =
        typeof entry?.ref.snapshot?.source_lorebook_name === 'string' ? entry.ref.snapshot.source_lorebook_name : null

    const submit = async () => {
        if (!entry) return
        await onSave(entry, { label: label.trim() || entry.label, description })
        onClose()
    }

    return (
        <Drawer
            open={entry !== null}
            onClose={onClose}
            eyebrow={meta?.label ?? 'Codex entry'}
            title={entry?.label ?? ''}
            icon={entry ? <Icon icon={KIND_ICONS[entry.kind]} size={18} /> : undefined}
            size="lg"
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button kind="ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button kind="primary" onClick={() => void submit()} disabled={busy} data-testid="codex-entry-save">
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            }
        >
            {entry && (
                <div className="flex flex-col gap-4">
                    <p className="m-0 font-ui text-xs text-parchment-400">
                        This is this novel's private copy of {entry.label} — the source {meta?.label.toLowerCase() ?? 'card'} is unaffected.
                    </p>
                    <Field label="Name">
                        <Input value={label} onChange={(e) => setLabel(e.target.value)} data-testid="codex-entry-name" />
                    </Field>
                    <Field label={entry.kind === 'lorebook_entry' ? 'Content' : 'Description'}>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={12}
                            data-testid="codex-entry-content"
                        />
                    </Field>
                    {entry.kind === 'lorebook_entry' && (keys.length > 0 || sourceLorebookName) && (
                        <div className="flex flex-col gap-2">
                            {keys.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-ui text-xs text-parchment-400">Keys:</span>
                                    {keys.map((key) => (
                                        <Tag key={key}>{key}</Tag>
                                    ))}
                                </div>
                            )}
                            {sourceLorebookName && (
                                <p className="m-0 font-ui text-xs text-parchment-400">Cloned from “{sourceLorebookName}”.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Drawer>
    )
}
