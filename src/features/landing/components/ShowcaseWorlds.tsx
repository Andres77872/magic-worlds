/**
 * Showcase worlds — a row of curated example characters/worlds so a first-time
 * or empty landing feels alive. These are inspiration, not the visitor's own
 * content; selecting one routes through the auth gate (sign in, then create).
 */

import type { KeyboardEvent, Ref } from 'react'
import { ArrowRight } from 'lucide-react'
import { Badge, Eyebrow, Icon, cx } from '@/ui/primitives'
import { SHOWCASE_WORLDS, type ShowcaseWorld } from './landingContent'

export interface ShowcaseWorldsProps {
    onTry: (world: ShowcaseWorld) => void
    sectionRef?: Ref<HTMLElement>
}

export function ShowcaseWorlds({ onTry, sectionRef }: ShowcaseWorldsProps) {
    return (
        <section ref={sectionRef} className="w-full scroll-mt-4 px-5 py-12 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1160px]">
                <div className="mb-8 flex flex-col gap-2 text-center">
                    <Eyebrow tone="ember">Worlds to wander into</Eyebrow>
                    <h2 className="font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        A door for every mood.
                    </h2>
                    <p className="mx-auto max-w-[480px] font-narrative text-[17px] leading-[1.5] text-parchment-400">
                        A few examples to spark the first scene — then bring your own cast and worlds.
                    </p>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-5">
                    {SHOWCASE_WORLDS.map((world) => (
                        <ShowcaseCard key={world.id} world={world} onTry={() => onTry(world)} />
                    ))}
                </div>
            </div>
        </section>
    )
}

interface ShowcaseCardProps {
    world: ShowcaseWorld
    onTry: () => void
}

function ShowcaseCard({ world, onTry }: ShowcaseCardProps) {
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onTry()
        }
    }
    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`${world.name} — ${world.genre} example. Sign in to begin.`}
            onClick={onTry}
            onKeyDown={onKeyDown}
            className={cx(
                'group relative min-h-[300px] cursor-pointer overflow-hidden rounded-xl border border-parchment-50/[.06] shadow-md transition-all',
                'hover:-translate-y-1 hover:border-ember-500/45 hover:shadow-card-hover',
            )}
        >
            <div className="absolute inset-0" aria-hidden style={{ background: world.portrait }} />
            <div
                className="absolute inset-0"
                aria-hidden
                style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(14,12,20,.9))' }}
            />
            <Badge tone="glass" className="absolute left-3.5 top-3.5">
                {world.genre}
            </Badge>
            <span
                className="pointer-events-none absolute bottom-[88px] right-[18px] select-none font-display font-semibold leading-none text-parchment-50/[.07]"
                aria-hidden
                style={{ fontSize: 110 }}
            >
                {world.initial}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="mb-1.5 font-mono text-[11px] text-ember-400">{world.world}</div>
                <h3 className="mb-2 font-display text-[28px] font-semibold leading-none text-parchment-50">
                    {world.name}
                </h3>
                <p className="mb-3 max-w-[360px] font-narrative text-[14.5px] leading-[1.45] text-parchment-200">
                    {world.hook}
                </p>
                <span className="inline-flex items-center gap-1.5 font-ui text-[13px] font-semibold text-ember-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Begin a scene
                    <Icon icon={ArrowRight} size={14} />
                </span>
            </div>
        </div>
    )
}
