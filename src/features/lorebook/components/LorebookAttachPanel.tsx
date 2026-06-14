import { Link2, Pin, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { Lorebook } from '@/shared'
import { Badge, Icon } from '@/ui/primitives'

interface LorebookAttachPanelProps {
    lorebook: Lorebook
}

function labelTarget(t: TFunction, targetKind: string, targetId?: string | null) {
    if (targetKind === 'global') return t('lorebookStudio.attachPanel.globalDefault')
    return `${targetKind.replace('_', ' ')}${targetId ? ` ${targetId.slice(0, 8)}` : ''}`
}

export function LorebookAttachPanel({ lorebook }: LorebookAttachPanelProps) {
    const { t } = useTranslation()
    return (
        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div>
                <h3 className="font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.attachPanel.title')}</h3>
                <p className="mt-1 font-narrative text-sm text-parchment-300">
                    {t('lorebookStudio.attachPanel.description')}
                </p>
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
