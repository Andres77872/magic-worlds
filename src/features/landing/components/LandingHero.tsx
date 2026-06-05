import { BookOpen, Globe, PenTool, Play, UserPlus, Zap } from 'lucide-react'
import type { Adventure } from '../../../shared'
import { Button, Card, Eyebrow, Icon } from '../../../ui/primitives'

interface LandingHeroProps {
    charactersCount: number
    worldsCount: number
    templatesCount: number
    activeAdventures: number
    isLoading?: boolean
    onStartJourney: () => void
    lastActiveAdventure?: Adventure
    onContinueAdventure?: (adventure: Adventure) => void
}

const SECTION_CLASS =
    'relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-6 md:min-h-[80vh] md:px-6 md:py-12'

const GLOW_STYLE = {
    background: 'radial-gradient(circle at 50% 0%, rgba(232,162,74,.16), transparent 70%)',
} as const

function HeroGlow() {
    return <div className="pointer-events-none absolute inset-0 z-[1]" style={GLOW_STYLE} aria-hidden="true" />
}

function HeroTitle({ subtitle }: { subtitle: string }) {
    return (
        <div className="mb-6">
            <Eyebrow tone="ember" className="mb-4 inline-block">Step into the story</Eyebrow>
            <h1 id="hero-title" className="font-display">
                <span className="block text-[clamp(2.5rem,7vw,5rem)] font-semibold leading-[1.02] tracking-tight text-parchment-50">
                    Magic Worlds
                </span>
                <span className="mt-3 block font-narrative text-[clamp(1.1rem,3vw,1.6rem)] font-normal italic text-parchment-200">
                    {subtitle}
                </span>
            </h1>
        </div>
    )
}

interface StatProps {
    icon: typeof UserPlus
    value: number
    label: string
}

function Stat({ icon, value, label }: StatProps) {
    return (
        <div className="flex min-w-[120px] flex-col items-center gap-2 rounded-md border border-parchment-50/10 bg-ink-700 p-4 transition-all hover:border-ember-500/45 hover:bg-ink-600 md:min-w-[140px] md:p-6">
            <Icon icon={icon} size={36} className="text-ember-400" />
            <span className="text-[2.2rem] font-bold leading-none text-parchment-50">{value}</span>
            <Eyebrow tone="muted" className="text-center text-[11px]">{label}</Eyebrow>
        </div>
    )
}

export function LandingHero({
    charactersCount,
    worldsCount,
    templatesCount,
    activeAdventures,
    isLoading,
    onStartJourney,
    lastActiveAdventure,
    onContinueAdventure,
}: LandingHeroProps) {
    const hasContent = charactersCount > 0 || worldsCount > 0 || templatesCount > 0 || activeAdventures > 0

    if (isLoading) {
        return (
            <section className={SECTION_CLASS} aria-labelledby="hero-title">
                <HeroGlow />
                <div className="relative z-[2] mx-auto max-w-[900px] text-center">
                    <HeroTitle subtitle="Loading your realm…" />
                </div>
            </section>
        )
    }

    return (
        <section className={SECTION_CLASS} aria-labelledby="hero-title">
            <HeroGlow />

            <div className="relative z-[2] mx-auto max-w-[900px] text-center">
                <HeroTitle subtitle="Forge Your Legend" />
                <p className="mx-auto mb-12 max-w-[600px] text-narrative leading-loose text-parchment-200">
                    Create epic characters, build mystical worlds, and embark on AI-powered adventures that bring your
                    imagination to life.
                </p>

                {!hasContent ? (
                    <div className="mt-12">
                        <Button
                            kind="primary"
                            size="lg"
                            onClick={onStartJourney}
                            aria-describedby="cta-description"
                            className="min-w-[280px] max-sm:w-full"
                            iconLeft={<Icon icon={Zap} size={20} />}
                        >
                            Start Your First Adventure
                        </Button>
                        <p id="cta-description" className="sr-only">
                            Begin your journey by creating your first character
                        </p>
                    </div>
                ) : (
                    <>
                        <div
                            className="mt-12 flex flex-wrap justify-center gap-4 md:gap-6"
                            role="region"
                            aria-label="Your magical world statistics"
                        >
                            <Stat icon={UserPlus} value={charactersCount} label="Heroes" />
                            <Stat icon={Globe} value={worldsCount} label="Worlds" />
                            <Stat icon={BookOpen} value={templatesCount} label="Templates" />
                            <Stat icon={PenTool} value={activeAdventures} label="Active Adventures" />
                        </div>

                        {lastActiveAdventure && onContinueAdventure && (
                            <div
                                className="mx-auto mt-12 flex w-full max-w-[680px] justify-center"
                                role="region"
                                aria-label="Your last active adventure"
                            >
                                <Card className="flex w-full flex-col gap-4 p-6 text-left">
                                    <div className="flex flex-col gap-2">
                                        <h3 className="m-0 font-display text-h3 font-semibold text-parchment-50">
                                            Your Active Adventure
                                        </h3>
                                        <p className="m-0 line-clamp-2 text-body leading-loose text-parchment-200">
                                            {lastActiveAdventure.scenario || 'Continue your magical journey…'}
                                        </p>
                                    </div>
                                    <Button
                                        kind="primary"
                                        onClick={() => onContinueAdventure(lastActiveAdventure)}
                                        aria-label="Continue your active adventure"
                                        className="self-end"
                                        iconLeft={<Icon icon={Play} size={18} />}
                                    >
                                        Continue Adventure
                                    </Button>
                                </Card>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    )
}
