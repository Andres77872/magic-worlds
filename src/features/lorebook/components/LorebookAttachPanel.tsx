import { useMemo, useState } from 'react'
import { Link2, Loader2, Pin, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { Lorebook, LorebookAttachment, LorebookAttachmentMode, LorebookTargetKind } from '@/shared'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import { ARCHIVED_WORKSPACE_MESSAGE_KEY } from '@/shared/hooks/useWorkspaceReadOnly'
import { ReadOnlyFieldset } from '@/features/creation/common/components/ReadOnlyFieldset'
import { Badge, Button, Field, Icon, Input, Select, type SelectOption } from '@/ui/primitives'
import { normalizeLorebookAttachment } from '../lorebookTransforms'

interface LorebookAttachPanelProps {
    lorebook: Lorebook
    /** The book's workspace (attachments live there); defaults to the committed one. */
    workspaceId?: string | null
    onChange?: (attachments: LorebookAttachment[]) => void
    /** The book's workspace is archived: existing attachments stay listed; nothing can be attached or removed. */
    readOnly?: boolean
}

function labelTarget(t: TFunction, targetKind: string, targetId?: string | null) {
    if (targetKind === 'global') return t('lorebookStudio.attachPanel.globalDefault')
    return `${targetKind.replace('_', ' ')}${targetId ? ` ${targetId.slice(0, 8)}` : ''}`
}

export function LorebookAttachPanel({ lorebook, workspaceId, onChange, readOnly = false }: LorebookAttachPanelProps) {
    const { t } = useTranslation()
    const api = useScopedApi(workspaceId)
    const { workspaceEpoch, capture, isCurrent } = useWorkspace()
    const [targetKind, setTargetKind] = useState<LorebookTargetKind>('global')
    const [targetId, setTargetId] = useState('')
    const [mode, setMode] = useState<LorebookAttachmentMode>('linked')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // A committed switch drops the half-filled target form of the previous workspace.
    const [formEpoch, setFormEpoch] = useState(workspaceEpoch)
    if (formEpoch !== workspaceEpoch) {
        setFormEpoch(workspaceEpoch)
        setTargetId('')
        setError(null)
    }

    const targetOptions = useMemo<SelectOption[]>(
        () => [
            { value: 'global', label: t('lorebookStudio.attachPanel.targets.global') },
            { value: 'character', label: t('lorebookStudio.attachPanel.targets.character') },
            { value: 'world', label: t('lorebookStudio.attachPanel.targets.world') },
            { value: 'adventure_template', label: t('lorebookStudio.attachPanel.targets.adventureTemplate') },
            { value: 'adventure_session', label: t('lorebookStudio.attachPanel.targets.adventureSession') },
            { value: 'character_chat', label: t('lorebookStudio.attachPanel.targets.characterChat') },
        ],
        [t],
    )
    const modeOptions = useMemo<SelectOption[]>(
        () => [
            { value: 'linked', label: t('lorebookStudio.attachPanel.linkedBadge') },
            { value: 'snapshot', label: t('lorebookStudio.attachPanel.snapshotBadge') },
        ],
        [t],
    )

    const replaceAttachment = (attachment: LorebookAttachment) => {
        const next = [
            attachment,
            ...lorebook.attachments.filter((item) => item.id !== attachment.id),
        ]
        onChange?.(next)
    }

    const removeAttachment = async (attachmentId: string) => {
        if (readOnly) {
            setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
            return
        }
        if (!api) return
        const scope = capture()
        setBusyId(attachmentId)
        setError(null)
        try {
            await api.deleteLorebookAttachment(attachmentId)
            if (!isCurrent(scope)) return
            onChange?.(lorebook.attachments.filter((attachment) => attachment.id !== attachmentId))
        } catch (err) {
            if (!isCurrent(scope)) return
            setError(err instanceof Error ? err.message : t('lorebookStudio.attachPanel.errors.deleteFailed'))
        } finally {
            setBusyId(null)
        }
    }

    const attach = async () => {
        if (readOnly) {
            setError(t(ARCHIVED_WORKSPACE_MESSAGE_KEY))
            return
        }
        if (!lorebook.id || !api) return
        const scope = capture()
        setBusyId('new')
        setError(null)
        try {
            const attachment = await api.putLorebookAttachment({
                lorebookId: lorebook.id,
                targetKind,
                targetId: targetKind === 'global' ? null : targetId.trim() || null,
                mode,
                snapshot: mode === 'snapshot' ? lorebook : null,
            })
            if (!isCurrent(scope)) return
            replaceAttachment(normalizeLorebookAttachment(attachment))
            setTargetId('')
        } catch (err) {
            if (!isCurrent(scope)) return
            setError(err instanceof Error ? err.message : t('lorebookStudio.attachPanel.errors.attachFailed'))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section aria-label={t('lorebookStudio.attachPanel.title')} className="flex min-w-0 flex-col gap-4 border-t border-parchment-50/10 pt-6">
            <div>
                <h3 className="font-display text-h3 font-semibold text-parchment-50">{t('lorebookStudio.attachPanel.title')}</h3>
                <p className="mt-1 font-narrative text-sm text-parchment-300">
                    {t('lorebookStudio.attachPanel.description')}
                </p>
            </div>

            <ReadOnlyFieldset disabled={readOnly} className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('lorebookStudio.attachPanel.targetKindLabel')}>
                        <Select
                            options={targetOptions}
                            value={targetKind}
                            onChange={(value) => setTargetKind(value as LorebookTargetKind)}
                            size="sm"
                        />
                    </Field>
                    <Field label={t('lorebookStudio.attachPanel.modeLabel')}>
                        <Select
                            options={modeOptions}
                            value={mode}
                            onChange={(value) => setMode(value as LorebookAttachmentMode)}
                            size="sm"
                        />
                    </Field>
                </div>
                {targetKind !== 'global' && (
                    <Field label={t('lorebookStudio.attachPanel.targetIdLabel')} helper={t('lorebookStudio.attachPanel.targetIdHelper')}>
                        <Input
                            value={targetId}
                            onChange={(event) => setTargetId(event.target.value)}
                            placeholder={t('lorebookStudio.attachPanel.targetIdPlaceholder')}
                        />
                    </Field>
                )}
                <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={busyId === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Icon icon={Plus} size={15} />}
                    disabled={!lorebook.id || busyId !== null}
                    onClick={attach}
                >
                    {lorebook.id ? t('lorebookStudio.attachPanel.attach') : t('lorebookStudio.attachPanel.saveFirst')}
                </Button>
                {error && (
                    <div className="rounded-md border border-blood-500/25 bg-blood-500/10 px-3 py-2 font-ui text-xs text-parchment-200">
                        {error}
                    </div>
                )}
            </ReadOnlyFieldset>

            {lorebook.attachments.length === 0 ? (
                <div className="px-4 py-6 text-center">
                    <Icon icon={Pin} size={28} className="mx-auto text-arcane-300" />
                    <p className="mt-2 font-ui text-sm text-parchment-200">{t('lorebookStudio.attachPanel.emptyTitle')}</p>
                    <p className="mt-1 font-narrative text-sm text-parchment-400">
                        {t('lorebookStudio.attachPanel.emptyDescription')}
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-parchment-50/10">
                    {lorebook.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                                <div className="font-ui text-sm font-semibold capitalize text-parchment-50">
                                    {labelTarget(t, attachment.targetKind, attachment.targetId)}
                                </div>
                                <p className="font-ui text-xs text-parchment-400">
                                    {attachment.mode === 'snapshot'
                                        ? t('lorebookStudio.attachPanel.snapshotMode')
                                        : t('lorebookStudio.attachPanel.linkedMode')}
                                </p>
                            </div>
                            <Badge tone={attachment.mode === 'snapshot' ? 'ember' : 'arcane'} icon={<Icon icon={attachment.mode === 'snapshot' ? Save : Link2} size={11} />}>
                                {attachment.mode === 'snapshot'
                                    ? t('lorebookStudio.attachPanel.snapshotBadge')
                                    : t('lorebookStudio.attachPanel.linkedBadge')}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={busyId === attachment.id ? <Loader2 size={14} className="animate-spin" /> : <Icon icon={Trash2} size={14} />}
                                disabled={busyId !== null || readOnly}
                                onClick={() => void removeAttachment(attachment.id)}
                            >
                                {t('common.delete')}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
