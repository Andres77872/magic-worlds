import { Link2, Pin, Save } from 'lucide-react'
import type { Lorebook } from '@/shared'
import { Badge, Icon } from '@/ui/primitives'

interface LorebookAttachPanelProps {
    lorebook: Lorebook
}

function labelTarget(targetKind: string, targetId?: string | null) {
    if (targetKind === 'global') return 'Global default'
    return `${targetKind.replace('_', ' ')}${targetId ? ` ${targetId.slice(0, 8)}` : ''}`
}

export function LorebookAttachPanel({ lorebook }: LorebookAttachPanelProps) {
    return (
        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div>
                <h3 className="font-display text-xl font-semibold text-parchment-50">Attachments</h3>
                <p className="mt-1 font-narrative text-sm text-parchment-300">
                    Attachments decide where this lorebook is active. Linked attachments follow future edits; snapshots stay frozen.
                </p>
            </div>

            {lorebook.attachments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-parchment-50/15 bg-ink-700/30 px-4 py-6 text-center">
                    <Icon icon={Pin} size={28} className="mx-auto text-ember-400" />
                    <p className="mt-2 font-ui text-sm text-parchment-200">No targets attached yet.</p>
                    <p className="mt-1 font-narrative text-sm text-parchment-400">
                        Card-level attach panels can link this book once the related editor surfaces are wired.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-parchment-50/[.06] overflow-hidden rounded-lg border border-parchment-50/[.08]">
                    {lorebook.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between gap-3 bg-ink-700 px-4 py-3">
                            <div className="min-w-0">
                                <div className="font-ui text-sm font-semibold capitalize text-parchment-50">
                                    {labelTarget(attachment.targetKind, attachment.targetId)}
                                </div>
                                <p className="font-ui text-xs text-parchment-400">
                                    {attachment.mode === 'snapshot' ? 'Frozen at attach time' : 'Follows saved lorebook edits'}
                                </p>
                            </div>
                            <Badge tone={attachment.mode === 'snapshot' ? 'ember' : 'arcane'} icon={<Icon icon={attachment.mode === 'snapshot' ? Save : Link2} size={11} />}>
                                {attachment.mode}
                            </Badge>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
