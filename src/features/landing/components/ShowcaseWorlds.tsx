/**
 * Showcase worlds — a row of curated example characters/worlds so a first-time
 * or empty landing feels alive. These are inspiration, not the visitor's own
 * content; selecting one routes through the auth gate (sign in, then create).
 *
 * The cards ARE the real `GalleryCard` (genre → badge, location → mono eyebrow,
 * hook → description) so the landing and the in-app galleries share one design
 * and can't drift. `staticCard` drops the action bubble; `staticImageUrl` feeds
 * the bundled marketing art straight to a plain <img> (it must NOT go through the
 * authenticated media hook — see Portrait.staticSrc).
 */

import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { showcaseArt } from '@/assets/marketing'
import { CardGrid, GalleryCard } from '@/ui/components/lists/Card'
import { Eyebrow } from '@/ui/primitives'
import { SHOWCASE_WORLDS, type ShowcaseWorld } from './landingContent'

export interface ShowcaseWorldsProps {
    onTry: (world: ShowcaseWorld) => void
    sectionRef?: Ref<HTMLElement>
}

export function ShowcaseWorlds({ onTry, sectionRef }: ShowcaseWorldsProps) {
    const { t } = useTranslation()
    return (
        <section ref={sectionRef} className="w-full scroll-mt-4 px-5 py-12 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-[1160px]">
                <div className="mb-8 flex flex-col gap-2 text-center">
                    <Eyebrow tone="ember">{t('landing.showcase.eyebrow')}</Eyebrow>
                    <h2 className="font-display text-h1 font-semibold leading-[1.05] text-parchment-50">
                        {t('landing.showcase.title')}
                    </h2>
                    <p className="mx-auto max-w-[480px] font-narrative text-[17px] leading-[1.5] text-parchment-400">
                        {t('landing.showcase.subtitle')}
                    </p>
                </div>
                <CardGrid
                    items={SHOWCASE_WORLDS}
                    layout="grid"
                    getItemKey={(world) => world.id}
                    showEmptyState={false}
                    renderCard={(world) => {
                        const genre = t(`landing.showcase.worlds.${world.id}.genre`)
                        return (
                            <GalleryCard
                                title={world.name}
                                badge={genre}
                                eyebrow={world.world}
                                description={t(`landing.showcase.worlds.${world.id}.hook`)}
                                gradient={world.portrait}
                                staticImageUrl={showcaseArt[world.id]}
                                onClick={() => onTry(world)}
                                actionLabel={t('landing.showcase.cardAria', { name: world.name, genre })}
                                staticCard
                            />
                        )
                    }}
                />
            </div>
        </section>
    )
}
