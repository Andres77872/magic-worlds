/**
 * Adventure-mode right panel — the turn-by-turn log of the session. Progress is
 * persisted automatically after every turn (see saveTurnsToApi in the center
 * panel), so there is no manual save affordance.
 */
import type { TurnEntry } from '../../../shared'
import { History } from 'lucide-react'
import { SectionHeader } from '../../../ui/primitives'

interface InteractionRightPanelProps {
    turns?: TurnEntry[]
}

export function InteractionRightPanel({ turns = [] }: InteractionRightPanelProps) {
    const truncateText = (text: string, maxLength: number = 50): string => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    const formatTime = (timestamp: string): string => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="flex flex-col gap-6 p-5">
            <section className="flex flex-col gap-2">
                <SectionHeader icon={History} title="Adventure Log" />
                <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
                    {turns.length === 0 ? (
                        <div className="rounded-lg border border-parchment-50/10 bg-ink-700 p-4 text-center">
                            <p className="font-narrative italic text-parchment-400">
                                No adventure logs yet.
                                <br />
                                Start your adventure to see the story unfold!
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
                                        {turn.type === 'user' ? 'You' : 'GM'}
                                    </span>
                                </div>
                                <div className="text-[13px] text-parchment-200">{truncateText(turn.content)}</div>
                            </div>
                        ))
                    )}
                </div>
                <p className="m-0 font-ui text-[12px] text-parchment-500">Progress saves automatically.</p>
            </section>
        </div>
    )
}
