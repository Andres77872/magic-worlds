import { useMemo, useState } from 'react'
import { Link2, Loader2, Pin, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { apiService } from '@/infrastructure/api'
import type { Lorebook, LorebookAttachment, LorebookAttachmentMode, LorebookTargetKind } from '@/shared'
import { Badge, Button, Field, Icon, Input, Select, type SelectOption } from '@/ui/primitives'
import { normalizeLorebookAttachment } from '../lorebookTransforms'

interface LorebookAttachPanelProps {
    lorebook: Lorebook
    onChange?: (attachments: LorebookAttachment[]) => void
}

function labelTarget(t: TFunction, targetKind: string, targetId?: string | null) {
    if (targetKind === 'global') return t('lorebookStudio.attachPanel.globalDefault')
    return `${targetKind.replace('_', ' ')}${targetId ? ` ${targetId.slice(0, 8)}` : ''}`
}

export function LorebookAttachPanel({ lorebook, onChange }: LorebookAttachPanelProps) {
    const { t } = useTranslation()
    const [targetKind, setTargetKind] = useState<LorebookTargetKind>('global')
    const [targetId, setTargetId] = useState('')
    const [mode, setMode] = useState<LorebookAttachmentMode>('linked')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

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
        setBusyId(attachmentId)
        setError(null)
        try {
            await apiService.deleteLorebookAttachment(attachmentId)
            onChange?.(lorebook.attachments.filter((attachment) => attachment.id !== attachmentId))
        } catch (err) {
            setError(err instanceof Error ? err.message : t('lorebookStudio.attachPanel.errors.deleteFailed'))
        } finally {
            setBusyId(null)
        }
    }

    const attach = async () => {
        if (!lorebook.id) return
        setBusyId('new')
        setError(null)
        try {
            const attachment = await apiService.putLorebookAttachment({
                lorebookId: lorebook.id,
                targetKind,
                targetId: targetKind === 'global' ? null : targetId.trim() || null,
                mode,
                snapshot: mode === 'snapshot' ? lorebook : null,
            })
            replaceAttachment(normalizeLorebookAttachment(attachment))
            setTargetId('')
        } catch (err) {
            setError(err instanceof Error ? err.message : t('lorebookStudio.attachPanel.errors.attachFailed'))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div>
                <h3 className="font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.attachPanel.title')}</h3>
                <p className="mt-1 font-narrative text-sm text-parchment-300">
                    {t('lorebookStudio.attachPanel.description')}
                </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700/40 p-3">
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
            </div>

            {lorebook.attachments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-parchment-50/15 bg-ink-700/30 px-4 py-6 text-center">
                    <Icon icon={Pin} size={28} className="mx-auto text-ember-400" />
                    <p className="mt-2 font-ui text-sm text-parchment-200">{t('lorebookStudio.attachPanel.emptyTitle')}</p>
                    <p className="mt-1 font-narrative text-sm text-parchment-400">
                        {t('lorebookStudio.attachPanel.emptyDescription')}
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-parchment-50/[.06] overflow-hidden rounded-lg border border-parchment-50/[.08]">
                    {lorebook.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between gap-3 bg-ink-700 px-4 py-3">
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
                                disabled={busyId !== null}
                                onClick={() => void removeAttachment(attachment.id)}
                            >
                                {t('common.delete')}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
