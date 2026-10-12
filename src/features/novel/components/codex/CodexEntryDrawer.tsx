/**
 * CodexEntryDrawer — view/edit one cloned snapshot (name + content). Edits
 * merge into the ref's snapshot only: the source card or lorebook entry is
 * never touched.
 *
 * `readOnly` (the story's workspace is archived) keeps it a viewer: the fields
 * stay selectable for reading and copying, Save is disabled, and the archived
 * notice says why.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive } from 'lucide-react'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import { Icon, Button, Callout, Drawer, Field, Input, Tag, Textarea } from '@/ui/primitives'
import type { CodexEntry } from '../../hooks/useCodex'
import { KIND_ICONS, KIND_META } from '../../utils/codexUtils'

interface CodexEntryDrawerProps {
    entry: CodexEntry | null
    busy: boolean
    /** The story's workspace is archived: view only. */
    readOnly?: boolean
    onClose: () => void
    onSave: (entry: CodexEntry, patch: { label: string; description: string }) => Promise<void>
}

export function CodexEntryDrawer({ entry, busy, readOnly = false, onClose, onSave }: CodexEntryDrawerProps) {
    const { t } = useTranslation()
    const [label, setLabel] = useState('')
    const [description, setDescription] = useState('')
    const [error, setError] = useState<string | null>(null)

    const entryId = entry?.id ?? null
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLabel(entry?.label ?? '')
        setDescription(entry?.description ?? '')
        setError(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entryId])

    const meta = entry ? KIND_META.find((item) => item.kind === entry.kind) : null
    const metaLabel = meta ? t(meta.labelKey) : null
    const keys = entry?.kind === 'lorebook_entry' && entry.label ? [entry.label] : []
    const sourceLorebookName = entry?.ref.snapshot.source_lorebook_id ?? null

    const submit = async () => {
        if (!entry) return
        if (readOnly) {
            setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
            return
        }
        setError(null)
        try {
            await onSave(entry, { label: label.trim() || entry.label, description })
            onClose()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('novelEditor.save.failed'))
        }
    }

    return (
        <Drawer
            open={entry !== null}
            onClose={onClose}
            eyebrow={metaLabel ?? t('novelEditor.entryDrawer.defaultEyebrow')}
            title={entry?.label ?? ''}
            icon={entry ? <Icon icon={KIND_ICONS[entry.kind]} size={18} /> : undefined}
            size="lg"
            footer={
                <div className="flex w-full items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} disabled={busy}>
                        {readOnly ? t('common.close') : t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => void submit()} disabled={busy || readOnly} data-testid="codex-entry-save">
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            }
        >
            {entry && (
                <div className="flex flex-col gap-4">
                    {readOnly && (
                        <Callout tone="warning" role="status" icon={<Icon icon={Archive} size={16} />} data-testid="codex-entry-archived">
                            {t(ARCHIVED_WORKSPACE_MESSAGE_KEY)}
                        </Callout>
                    )}
                    {error && <Callout tone="danger" role="alert">{error}</Callout>}
                    <p className="m-0 font-ui text-xs text-parchment-400">
                        {t('novelEditor.entryDrawer.privateCopy', { label: entry.label, kind: metaLabel ? metaLabel.toLowerCase() : t('novelEditor.entryDrawer.defaultKind') })}
                    </p>
                    <Field label={t('novelEditor.entryDrawer.name')}>
                        <Input value={label} onChange={(e) => setLabel(e.target.value)} readOnly={readOnly} data-testid="codex-entry-name" />
                    </Field>
                    <Field label={entry.kind === 'lorebook_entry' ? t('novelEditor.entryDrawer.content') : t('novelEditor.entryDrawer.description')}>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            readOnly={readOnly}
                            rows={12}
                            data-testid="codex-entry-content"
                        />
                    </Field>
                    {entry.kind === 'lorebook_entry' && (keys.length > 0 || sourceLorebookName) && (
                        <div className="flex flex-col gap-2">
                            {keys.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-ui text-xs text-parchment-400">{t('novelEditor.entryDrawer.keys')}</span>
                                    {keys.map((key) => (
                                        <Tag key={key}>{key}</Tag>
                                    ))}
                                </div>
                            )}
                            {sourceLorebookName && (
                                <p className="m-0 font-ui text-xs text-parchment-400">{t('novelEditor.entryDrawer.clonedFrom', { name: sourceLorebookName })}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Drawer>
    )
}
