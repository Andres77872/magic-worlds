/**
 * NovelGenerationHistoryDrawer — every past generation across chapters,
 * newest first, with status badges and copy-to-clipboard re-use.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clipboard, History } from 'lucide-react'
import type { StoryGenerationStatus } from '@/shared'
import { Badge, Drawer, Icon, IconButton, Tag } from '@/ui/primitives'
import type { HistoryGeneration } from '../hooks/useGenerationHistory'

const STATUS_TONE: Record<StoryGenerationStatus, 'ember' | 'arcane' | 'glass'> = {
    candidate: 'arcane',
    accepted: 'ember',
    rejected: 'glass',
    stashed: 'glass',
}

interface NovelGenerationHistoryDrawerProps {
    open: boolean
    generations: HistoryGeneration[]
    onClose: () => void
}

export function NovelGenerationHistoryDrawer({ open, generations, onClose }: NovelGenerationHistoryDrawerProps) {
    const { t } = useTranslation()
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const copy = async (generation: HistoryGeneration) => {
        try {
            await navigator.clipboard?.writeText(generation.output)
            setCopiedId(generation.id)
            window.setTimeout(() => setCopiedId((current) => (current === generation.id ? null : current)), 1400)
        } catch (error) {
            console.error('Failed to copy generation:', error)
        }
    }

    return (
        <Drawer open={open} onClose={onClose} eyebrow={t('novelEditor.history.eyebrow')} title={t('novelEditor.history.title')} icon={<Icon icon={History} size={18} />} size="lg">
            {generations.length === 0 ? (
                <p className="m-0 py-6 text-center font-ui text-sm text-parchment-400">
                    {t('novelEditor.history.empty')}
                </p>
            ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {generations.map((generation) => (
                        <li
                            key={generation.id}
                            className="rounded-md border border-parchment-50/10 bg-ink-700/60 p-3"
                            data-testid="generation-history-item"
                        >
                            <div className="mb-1.5 flex items-center gap-2">
                                <Badge tone={STATUS_TONE[generation.status] ?? 'glass'}>{t(`novelEditor.history.status.${generation.status}`)}</Badge>
                                <Tag>{generation.command}</Tag>
                                <span className="min-w-0 flex-1 truncate font-ui text-xs text-parchment-400">{generation.chapterTitle}</span>
                                <IconButton label={t('novelEditor.history.copy')} size="sm" onClick={() => void copy(generation)}>
                                    <Icon icon={copiedId === generation.id ? Check : Clipboard} size={14} />
                                </IconButton>
                            </div>
                            <p className="m-0 line-clamp-4 whitespace-pre-wrap font-narrative text-[14px] leading-6 text-parchment-200">
                                {generation.output}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </Drawer>
    )
}
