import { Globe, Sparkles, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, Eyebrow, Icon } from '../../../ui/primitives'

interface Tip {
    step: string
    icon: LucideIcon
    title: string
    description: string
}

const TIPS: Tip[] = [
    {
        step: '01',
        icon: UserPlus,
        title: 'Create Your Hero',
        description: 'Design a character with the stats, skills, and backstory that will shape your adventures.',
    },
    {
        step: '02',
        icon: Globe,
        title: 'Build Your World',
        description: 'Craft the setting where your story unfolds, complete with lore and atmosphere.',
    },
    {
        step: '03',
        icon: Sparkles,
        title: 'Start an Adventure',
        description: 'Launch into an AI-powered story with your cast and watch the scene come alive.',
    },
]

export function LandingTips() {
    return (
        <section className="relative z-[2] px-4 py-12 sm:px-6" aria-labelledby="tips-title">
            <div className="mx-auto mb-10 max-w-[900px] text-center">
                <Eyebrow tone="arcane">How it works</Eyebrow>
                <h2 id="tips-title" className="mt-3 font-display text-h2 font-bold text-parchment-50">
                    Three steps to your first scene
                </h2>
            </div>

            <ol className="mx-auto grid max-w-[1000px] grid-cols-1 gap-6 md:grid-cols-3">
                {TIPS.map((tip) => (
                    <li key={tip.step}>
                        <Card className="flex h-full flex-col gap-4 p-6 transition-all hover:-translate-y-[3px] hover:border-ember-500/45 hover:shadow-card-hover md:p-8">
                            <div className="flex items-center justify-between">
                                <span
                                    className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-arcane-500/15 text-arcane-300"
                                    aria-hidden="true"
                                >
                                    <Icon icon={tip.icon} size={24} />
                                </span>
                                <span className="font-mono text-[28px] font-bold leading-none text-parchment-50/10">
                                    {tip.step}
                                </span>
                            </div>
                            <h3 className="font-display text-h3 font-semibold text-parchment-50">{tip.title}</h3>
                            <p className="text-body leading-relaxed text-parchment-200">{tip.description}</p>
                        </Card>
                    </li>
                ))}
            </ol>
        </section>
    )
}
