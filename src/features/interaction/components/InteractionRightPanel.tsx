import type { Adventure, TurnEntry } from '../../../shared'
import { Dice5, History, Save, Settings } from 'lucide-react'
import { Button, Icon, SectionHeader } from '../../../ui/primitives'

interface InteractionRightPanelProps {
    adventure: Adventure
    turns?: TurnEntry[]
}

export function InteractionRightPanel({ turns = [] }: InteractionRightPanelProps) {
    const handleDiceRoll = () => {
        const roll = Math.floor(Math.random() * 20) + 1
        const message = roll === 20 ? '🎉 Critical Success!' : roll === 1 ? '💀 Critical Failure!' : `You rolled a ${roll}!`
        alert(`🎲 ${message}`)
    }

    const handleSaveAdventure = () => {
        alert('✨ Adventure progress saved!')
    }

    const truncateText = (text: string, maxLength: number = 50): string => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
    }

    const formatTime = (timestamp: string): string => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="flex flex-col gap-6 p-5">
            <section className="flex flex-col gap-2">
                <SectionHeader icon={Dice5} title="Quick Actions" />
                <div className="flex flex-col gap-2">
                    <Button kind="secondary" full iconLeft={<Icon icon={Dice5} size={16} />} onClick={handleDiceRoll}>
                        Roll D20
                    </Button>
                    <Button kind="primary" full iconLeft={<Icon icon={Save} size={16} />} onClick={handleSaveAdventure}>
                        Save Progress
                    </Button>
                </div>
            </section>

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
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeader icon={Settings} title="Settings" />
                <div className="flex flex-col gap-2.5">
                    {[
                        { label: 'Auto-save progress', checked: true },
                        { label: 'Show dice rolls in chat', checked: false },
                        { label: 'Enable sound effects', checked: true },
                    ].map((setting) => (
                        <label
                            key={setting.label}
                            className="flex cursor-pointer items-center gap-2.5 text-[14px] text-parchment-200"
                        >
                            <input
                                type="checkbox"
                                defaultChecked={setting.checked}
                                className="h-4 w-4 rounded accent-ember-500"
                            />
                            <span>{setting.label}</span>
                        </label>
                    ))}
                </div>
            </section>
        </div>
    )
}
