import type { Adventure } from '../../../shared'
import { ArrowLeft, Globe, Info, Users } from 'lucide-react'
import { Button, Icon, SectionHeader } from '../../../ui/primitives'

interface InteractionLeftPanelProps {
    adventure: Adventure
    onBack: () => void
}

const card = 'rounded-lg border border-parchment-50/10 bg-ink-700 p-4'

export function InteractionLeftPanel({ adventure, onBack }: InteractionLeftPanelProps) {
    return (
        <div className="flex flex-col gap-6 p-5">
            <Button kind="secondary" full iconLeft={<Icon icon={ArrowLeft} size={16} />} onClick={onBack}>
                Back to Adventures
            </Button>

            <section className="flex flex-col gap-2">
                <SectionHeader icon={Info} title="Adventure Scenario" />
                <div className={card}>
                    <p className="font-narrative text-[15px] leading-relaxed text-parchment-200">{adventure.scenario}</p>
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeader icon={Globe} title="World Setting" />
                {adventure.world ? (
                    <div className={card}>
                        <h5 className="font-display text-[18px] font-semibold text-parchment-50">{adventure.world.name}</h5>
                        <span className="mt-0.5 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-ember-400">
                            {adventure.world.type}
                        </span>
                        {adventure.world.details && Object.keys(adventure.world.details).length > 0 && (
                            <div className="mt-3 flex flex-col gap-1.5">
                                {Object.entries(adventure.world.details).map(([key, value]) => (
                                    <div key={key} className="flex gap-2 text-[13px]">
                                        <span className="text-parchment-400">{key}:</span>
                                        <span className="text-parchment-100">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={card}>
                        <p className="italic text-parchment-400">No world selected</p>
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-2">
                <SectionHeader icon={Users} title="Characters" />
                {adventure.characters && adventure.characters.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {adventure.characters.map((character) => (
                            <div key={character.id} className={card}>
                                <h5 className="font-display text-[18px] font-semibold text-parchment-50">{character.name}</h5>
                                <span className="mt-0.5 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-arcane-300">
                                    {character.race}
                                </span>
                                {character.stats && Object.keys(character.stats).length > 0 && (
                                    <div className="mt-3 flex flex-col gap-1.5">
                                        {Object.entries(character.stats).map(([key, value]) => (
                                            <div key={key} className="flex gap-2 text-[13px]">
                                                <span className="text-parchment-400">{key}:</span>
                                                <span className="text-parchment-100">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={card}>
                        <p className="italic text-parchment-400">No characters selected</p>
                    </div>
                )}
            </section>
        </div>
    )
}
