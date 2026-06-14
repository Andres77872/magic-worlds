/**
 * Adventure-mode right panel — the turn-by-turn log of the session. Progress is
 * persisted automatically after every turn (see saveTurnsToApi in the center
 * panel), so there is no manual save affordance.
 */
import type { TurnEntry } from '../../../shared'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SectionHeader } from '../../../ui/primitives'
import { formatApiTime } from '@/utils/time'

interface InteractionRightPanelProps {
    turns?: TurnEntry[]
}

export function InteractionRightPanel({ turns = [] }: InteractionRightPanelProps) {
    const { t } = useTranslation()

    const truncateText = (text: string, maxLength: number = 50): string => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    const formatTime = (timestamp: string): string => {
        return formatApiTime(timestamp)
    }

    return (
        <div className="flex h-full flex-col p-5">
            <SectionHeader icon={History} title={t('interaction.logPanel.title')} className="shrink-0" />
            <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {turns.length === 0 ? (
                    <div className="rounded-lg border border-parchment-50/10 bg-ink-700 p-4 text-center">
                        <p className="font-narrative italic text-parchment-400">
                            {t('interaction.logPanel.emptyTitle')}
                            <br />
                            {t('interaction.logPanel.emptyHint')}
                        </p>
                    </div>
                ) : (
                    turns.map((turn, index) => (
                        <div
                            key={turn.id || index}
                            className="rounded-lg border border-parchment-50/10 bg-ink-700 p-3"
                        >
                            <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                                <span className="text-parchment-500">{formatTime(turn.timestamp)}</span>
                                <span
                                    className={
                                        turn.type === 'user'
                                            ? 'rounded-full bg-ember-500/15 px-2 py-0.5 text-ember-300'
                                            : 'rounded-full bg-arcane-500/15 px-2 py-0.5 text-arcane-300'
                                    }
                                >
                                    {turn.type === 'user' ? t('interaction.logPanel.you') : t('interaction.logPanel.gm')}
                                </span>
                            </div>
                            <div className="text-[13px] text-parchment-200">{truncateText(turn.content)}</div>
                        </div>
                    ))
                )}
            </div>
            <p className="mt-3 shrink-0 font-ui text-[12px] text-parchment-500">{t('interaction.logPanel.autoSave')}</p>
        </div>
    )
}
