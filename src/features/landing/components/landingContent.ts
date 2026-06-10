/**
 * Landing copy, marketing data, and small helpers — kept out of the JSX so the
 * orchestrator and section components stay legible (mirrors how `sceneModel.ts`
 * centralizes the scene mapping). Copy is honest to Magic Worlds: an open-source
 * AI-roleplay sandbox — no pricing, no fabricated stats.
 */

import type { LucideIcon } from 'lucide-react'
import { Feather, Globe, Infinity as InfinityIcon, Swords, Users, UsersRound } from 'lucide-react'
import type { Adventure } from '@/shared'

export const GITHUB_URL = 'https://github.com/Andres77872/magic-worlds'

/** Hero copy for the marketing front-door (guest / empty-account view). */
export const HERO_COPY = {
    eyebrow: 'Open-source AI roleplay',
    title: 'Worlds that talk back.',
    subtitle:
        'Step into living stories with characters who speak, react, and remember. ' +
        "Pick who you'll become — and write what happens next, together.",
    /** Caption beside the sample-world avatar stack (honest, not a fake count). */
    stat: 'A handful of worlds to wander into — bring or build your own.',
} as const

/** The "how it works" explainer — the choose → set scene → play-it-out loop. */
export interface HowStep {
    icon: LucideIcon
    title: string
    body: string
}

export const HOW_IT_WORKS_STEPS: HowStep[] = [
    {
        icon: UsersRound,
        title: "Choose who you'll meet",
        body: 'Browse a cast across every genre — or conjure your own character in a sentence.',
    },
    {
        icon: Feather,
        title: 'Set the opening scene',
        body: 'A rainy inn. A derelict station. A first line. You decide where the story starts.',
    },
    {
        icon: InfinityIcon,
        title: 'Play it out, turn by turn',
        body: 'They speak, react, and remember. The story is improvised between you — and it never ends the same way twice.',
    },
]

/** The prominent in-page create / access menu. */
export interface CreateAction {
    key: 'character' | 'world' | 'adventure'
    icon: LucideIcon
    /** Arcane is reserved for AI/magic — the character is the AI persona. */
    tone: 'ember' | 'arcane'
    title: string
    desc: string
}

export const CREATE_ACTIONS: CreateAction[] = [
    {
        key: 'character',
        icon: Users,
        tone: 'arcane',
        title: 'Create a character',
        desc: 'Conjure a persona who speaks, reacts, and remembers — in a sentence or in depth.',
    },
    {
        key: 'world',
        icon: Globe,
        tone: 'ember',
        title: 'Build a world',
        desc: 'Set the stage: a place, its rules, and the lore that pulls characters in.',
    },
    {
        key: 'adventure',
        icon: Swords,
        tone: 'ember',
        title: 'Forge an adventure',
        desc: 'Frame the opening scene and let the story improvise, turn by turn.',
    },
]

/** Closing call-to-action band copy. */
export const CLOSING_COPY = {
    title: 'Your scene is waiting.',
    subtitle: 'A quiet inn. A stranger by the fire. A story only you can finish.',
    action: 'Begin an adventure',
} as const

/**
 * The "two ways to play" explainer — the one place that spells out Adventure
 * (GM-led party role-play, ember) vs Chat (1:1 conversation, arcane). Icons and
 * labels come from MODE_META so this band teaches the same color language the
 * badges use everywhere else.
 */
export const MODE_EXPLAINER = {
    eyebrow: 'Two ways to play',
    title: 'Lead a party, or pull up a chair.',
    modes: [
        {
            mode: 'adventure',
            body:
                'A Game Master narrates a living scene in third person. Bring a world, a cast, ' +
                "and the persona you'll play — choose suggested actions or write your own, " +
                'and watch scenes get illustrated as the story unfolds.',
        },
        {
            mode: 'chat',
            body:
                'One character, face to face. They greet you, speak in first person, and ' +
                'remember the conversation. Start from any character card — returning picks ' +
                'up right where you left off.',
        },
    ],
} as const

/**
 * Curated sample worlds — shown to first-time / empty visitors so the page feels
 * alive. Portrait-gradient driven (no images). Clearly examples; clicking one
 * routes through the auth gate (sign in, then create your own).
 */
export interface ShowcaseWorld {
    id: string
    name: string
    /** Mono "where" label, e.g. "The Ember Coast". */
    world: string
    genre: string
    hook: string
    initial: string
    /** Literal radial-gradient string used as the card / avatar background. */
    portrait: string
}

export const SHOWCASE_WORLDS: ShowcaseWorld[] = [
    {
        id: 'lyra',
        name: 'Lyra',
        world: 'The Ember Coast',
        genre: 'Mystery',
        hook: 'A card-sharp innkeeper who knows more than she lets on.',
        initial: 'L',
        portrait: 'radial-gradient(120% 90% at 30% 20%,#4a3a6b,#241b38 60%,#160f24)',
    },
    {
        id: 'kael',
        name: 'Kael',
        world: "Vael's End",
        genre: 'Adventure',
        hook: 'An exiled knight searching for the heir he failed to protect.',
        initial: 'K',
        portrait: 'radial-gradient(120% 90% at 70% 25%,#6b3a48,#33202c 60%,#1a0f17)',
    },
    {
        id: 'soren',
        name: 'Dr. Soren',
        world: 'Halcyon Station',
        genre: 'Sci-fi',
        hook: "The station's last scientist, awake far longer than is wise.",
        initial: 'S',
        portrait: 'radial-gradient(120% 90% at 40% 30%,#274a52,#19303a 60%,#0e1c22)',
    },
    {
        id: 'mira',
        name: 'Mira',
        world: 'Saint-Avril',
        genre: 'Romance',
        hook: 'A florist with a stubborn streak and a letter she never sent.',
        initial: 'M',
        portrait: 'radial-gradient(120% 90% at 30% 25%,#5a4a2e,#322a1c 60%,#1a160e)',
    },
    {
        id: 'vex',
        name: 'Vex',
        world: 'Neon Mire',
        genre: 'Cyberpunk',
        hook: 'A back-alley fixer who deals in secrets and bad decisions.',
        initial: 'V',
        portrait: 'radial-gradient(120% 90% at 60% 20%,#3a2d5c,#221a3a 60%,#120e22)',
    },
    {
        id: 'wren',
        name: 'Wren',
        world: 'The Hollow Wood',
        genre: 'Folk',
        hook: "A child of the forest who speaks for things that don't.",
        initial: 'W',
        portrait: 'radial-gradient(120% 90% at 45% 25%,#2e5a3e,#1d3a2a 60%,#101f17)',
    },
]

/**
 * Most-recently-touched in-progress adventure (for the dashboard "Continue"
 * CTA). Max by updatedAt ?? createdAt; falls back to the last element since new
 * sessions are appended.
 */
export function latestInProgress(adventures: Adventure[]): Adventure | undefined {
    if (adventures.length === 0) return undefined
    let best = adventures[adventures.length - 1]
    let bestTime = -Infinity
    for (const adventure of adventures) {
        const stamp = adventure.updatedAt ?? adventure.createdAt
        const time = stamp ? Date.parse(stamp) : NaN
        if (!Number.isNaN(time) && time >= bestTime) {
            bestTime = time
            best = adventure
        }
    }
    return best
}
