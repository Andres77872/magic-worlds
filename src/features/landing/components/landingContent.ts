/**
 * Landing marketing data + small helpers — kept out of the JSX so the
 * orchestrator and section components stay legible (mirrors how `sceneModel.ts`
 * centralizes the scene mapping). User-facing copy lives in the i18n `landing.*`
 * namespace; the constants below carry i18n KEY strings beside their non-copy
 * data (icons, tones, gradients) so the consuming components resolve `t(key)` at
 * render. Honest to Magic Worlds: an open-source AI-roleplay sandbox — no
 * pricing, no fabricated stats.
 */

import type { LucideIcon } from 'lucide-react'
import { BookOpenText, Feather, Gem, Globe, Infinity as InfinityIcon, ScrollText, Swords, Users, UsersRound } from 'lucide-react'
import type { FeatureArtKey } from '@/assets/marketing'
import {
    isLorebooksFeatureEnabled,
    isNovelsFeatureEnabled,
    isVoicesFeatureEnabled,
} from '@/shared/featureFlags'

export const GITHUB_URL = 'https://github.com/Andres77872/magic-worlds'

/** The "how it works" explainer — the choose → set scene → play-it-out loop. */
export interface HowStep {
    icon: LucideIcon
    titleKey: string
    bodyKey: string
}

export const HOW_IT_WORKS_STEPS: HowStep[] = [
    {
        icon: UsersRound,
        titleKey: 'landing.steps.choose.title',
        bodyKey: 'landing.steps.choose.body',
    },
    {
        icon: Feather,
        titleKey: 'landing.steps.scene.title',
        bodyKey: 'landing.steps.scene.body',
    },
    {
        icon: InfinityIcon,
        titleKey: 'landing.steps.play.title',
        bodyKey: 'landing.steps.play.body',
    },
]

/** The prominent in-page create / access menu. */
export interface CreateAction {
    key: 'character' | 'world' | 'item' | 'adventure' | 'novel' | 'lorebook'
    icon: LucideIcon
    /** Arcane is reserved for AI/magic — the character is the AI persona. */
    tone: 'ember' | 'arcane'
    titleKey: string
    descKey: string
    /** One-breath hook for the compact create band tiles. */
    shortDescKey: string
}

export const CREATE_ACTIONS: CreateAction[] = [
    {
        key: 'character',
        icon: Users,
        tone: 'arcane',
        titleKey: 'landing.create.character.title',
        descKey: 'landing.create.character.desc',
        shortDescKey: 'landing.create.character.shortDesc',
    },
    {
        key: 'world',
        icon: Globe,
        tone: 'ember',
        titleKey: 'landing.create.world.title',
        descKey: 'landing.create.world.desc',
        shortDescKey: 'landing.create.world.shortDesc',
    },
    {
        key: 'item',
        icon: Gem,
        tone: 'ember',
        titleKey: 'landing.create.item.title',
        descKey: 'landing.create.item.desc',
        shortDescKey: 'landing.create.item.shortDesc',
    },
    {
        key: 'adventure',
        icon: Swords,
        tone: 'ember',
        titleKey: 'landing.create.adventure.title',
        descKey: 'landing.create.adventure.desc',
        shortDescKey: 'landing.create.adventure.shortDesc',
    },
    {
        key: 'novel',
        icon: BookOpenText,
        tone: 'ember',
        titleKey: 'landing.create.novel.title',
        descKey: 'landing.create.novel.desc',
        shortDescKey: 'landing.create.novel.shortDesc',
    },
    {
        key: 'lorebook',
        icon: ScrollText,
        tone: 'ember',
        titleKey: 'landing.create.lorebook.title',
        descKey: 'landing.create.lorebook.desc',
        shortDescKey: 'landing.create.lorebook.shortDesc',
    },
]

export function isCreateActionEnabled(action: CreateAction): boolean {
    if (action.key === 'novel') return isNovelsFeatureEnabled()
    if (action.key === 'lorebook') return isLorebooksFeatureEnabled()
    return true
}

/**
 * Illustrated "what you can build" gallery (guest front-door) — pairs each
 * generated feature illustration with the existing create copy. `key` indexes
 * `featureArt`; `themeSong`/`voice` reuse the new `landing.create.*` keys. This
 * is presentational only (no create wiring), so it carries no auth gating.
 */
export interface FeatureGalleryItem {
    key: FeatureArtKey
    titleKey: string
    descKey: string
}

export const FEATURE_GALLERY: FeatureGalleryItem[] = [
    { key: 'character', titleKey: 'landing.create.character.title', descKey: 'landing.create.character.desc' },
    { key: 'world', titleKey: 'landing.create.world.title', descKey: 'landing.create.world.desc' },
    { key: 'item', titleKey: 'landing.create.item.title', descKey: 'landing.create.item.desc' },
    { key: 'adventure', titleKey: 'landing.create.adventure.title', descKey: 'landing.create.adventure.desc' },
    { key: 'novel', titleKey: 'landing.create.novel.title', descKey: 'landing.create.novel.desc' },
    { key: 'lorebook', titleKey: 'landing.create.lorebook.title', descKey: 'landing.create.lorebook.desc' },
    { key: 'themeSong', titleKey: 'landing.create.themeSong.title', descKey: 'landing.create.themeSong.desc' },
    { key: 'voice', titleKey: 'landing.create.voice.title', descKey: 'landing.create.voice.desc' },
]

export function isFeatureGalleryItemEnabled(item: FeatureGalleryItem): boolean {
    if (item.key === 'novel') return isNovelsFeatureEnabled()
    if (item.key === 'lorebook') return isLorebooksFeatureEnabled()
    if (item.key === 'voice') return isVoicesFeatureEnabled()
    return true
}

/**
 * The "two ways to play" explainer — the one place that spells out Adventure
 * (GM-led party role-play, ember) vs Chat (1:1 conversation, arcane). Icons and
 * labels come from MODE_META so this band teaches the same color language the
 * badges use everywhere else. Body copy resolves from `landing.modes.<mode>`.
 */
export const MODE_EXPLAINER_MODES = [
    { mode: 'adventure', bodyKey: 'landing.modes.adventure' },
    { mode: 'chat', bodyKey: 'landing.modes.chat' },
] as const

/**
 * Curated sample worlds — shown to first-time / empty visitors so the page feels
 * alive. Portrait-gradient driven (no images). Clearly examples; clicking one
 * routes through the auth gate (sign in, then create your own). `name`/`world`
 * are proper-noun brands kept untranslated; `genre`/`hook` resolve from
 * `landing.showcase.worlds.<id>`.
 */
export interface ShowcaseWorld {
    id: string
    name: string
    /** Mono "where" label, e.g. "The Ember Coast". Proper noun — untranslated. */
    world: string
    initial: string
    /** Literal radial-gradient string used as the card / avatar background. */
    portrait: string
}

export const SHOWCASE_WORLDS: ShowcaseWorld[] = [
    {
        id: 'lyra',
        name: 'Lyra',
        world: 'The Ember Coast',
        initial: 'L',
        portrait: 'radial-gradient(120% 90% at 30% 20%,#4a3a6b,#241b38 60%,#160f24)',
    },
    {
        id: 'kael',
        name: 'Kael',
        world: "Vael's End",
        initial: 'K',
        portrait: 'radial-gradient(120% 90% at 70% 25%,#6b3a48,#33202c 60%,#1a0f17)',
    },
    {
        id: 'soren',
        name: 'Dr. Soren',
        world: 'Halcyon Station',
        initial: 'S',
        portrait: 'radial-gradient(120% 90% at 40% 30%,#274a52,#19303a 60%,#0e1c22)',
    },
    {
        id: 'mira',
        name: 'Mira',
        world: 'Saint-Avril',
        initial: 'M',
        portrait: 'radial-gradient(120% 90% at 30% 25%,#5a4a2e,#322a1c 60%,#1a160e)',
    },
    {
        id: 'vex',
        name: 'Vex',
        world: 'Neon Mire',
        initial: 'V',
        portrait: 'radial-gradient(120% 90% at 60% 20%,#3a2d5c,#221a3a 60%,#120e22)',
    },
    {
        id: 'wren',
        name: 'Wren',
        world: 'The Hollow Wood',
        initial: 'W',
        portrait: 'radial-gradient(120% 90% at 45% 25%,#2e5a3e,#1d3a2a 60%,#101f17)',
    },
]
