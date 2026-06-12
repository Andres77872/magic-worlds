/**
 * World guided-field registry — built for scene-setting. The `(group, key)`
 * bindings are the round-trip contract with saved cards: do not rename.
 */
import { CloudMoon, Crown, Flame, Globe, KeyRound, Layers, Map, ScrollText, Tags } from 'lucide-react'
import type { SelectOption } from '@/ui/primitives'
import { CUSTOM_WORLD_PLACE_TYPE, WORLD_PLACE_TYPE_OPTIONS } from '@/shared'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'

/** The Setting/Place type mirror — `place_type` is dual-written here so it
 * survives the backend (whose World model drops the first-class field). */
export const PLACE_TYPE_MIRROR = {
    group: 'Setting',
    key: 'Place type',
    groupDescription: 'The scale scenes are framed at.',
} as const

const PLACE_TYPE_DESCRIPTIONS: Record<string, string> = {
    world: 'An entire setting: planet, realm, or reality.',
    place: 'A single notable spot — keeps the scope tight.',
    continent: 'A landmass of many nations and climates.',
    country: 'One nation with borders, law, and a capital.',
    region: 'A province, valley, coast, or wilderness.',
    city: 'Streets, districts, politics, and crowds.',
    settlement: 'A village, outpost, or colony — small enough to know everyone.',
    landmark: 'One structure or feature: a tower, a bridge, a ruin.',
    plane: 'An otherworld with its own rules of reality.',
}

/** Existing shared place types, enriched with per-option example descriptions. */
export const PLACE_TYPE_SELECT_OPTIONS: SelectOption[] = [
    ...WORLD_PLACE_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        description: PLACE_TYPE_DESCRIPTIONS[option.value],
    })),
    { value: CUSTOM_WORLD_PLACE_TYPE, label: 'Custom', description: 'Name your own scale: moon, archipelago, star system…' },
]

export const GENRE_OPTIONS: SelectOption[] = [
    { value: 'High Fantasy', label: 'High Fantasy', description: 'Magic is grand, evil is named, heroism matters.' },
    { value: 'Dark Fantasy', label: 'Dark Fantasy', description: 'Magic costs; victories leave scars.' },
    { value: 'Gothic Horror', label: 'Gothic Horror', description: 'Candlelit dread, old houses, older sins.' },
    { value: 'Cosmic Horror', label: 'Cosmic Horror', description: 'The truth is vast, indifferent, and best unlearned.' },
    { value: 'Sci-Fi', label: 'Sci-Fi', description: "Starships, colonies, and tomorrow's problems." },
    { value: 'Cyberpunk', label: 'Cyberpunk', description: 'High tech, low life, neon over rot.' },
    { value: 'Steampunk', label: 'Steampunk', description: 'Brass, steam, and improbable machines.' },
    { value: 'Solarpunk', label: 'Solarpunk', description: 'Green futures, hopeful invention, communal stakes.' },
    { value: 'Post-Apocalyptic', label: 'Post-Apocalyptic', description: 'After the fall; scarcity writes the rules.' },
    { value: 'Urban Fantasy', label: 'Urban Fantasy', description: "Magic hiding in the modern city's blind spots." },
    { value: 'Historical', label: 'Historical', description: 'A real era, worn carefully or loosely.' },
    { value: 'Mythic', label: 'Mythic', description: 'Gods walk; stories are load-bearing.' },
    { value: 'Fairy Tale', label: 'Fairy Tale', description: 'Bargains, woods, and rules of three.' },
    { value: 'Political Intrigue', label: 'Political Intrigue', description: 'Words are weapons; dinners are battlefields.' },
    { value: 'Cozy', label: 'Cozy', description: 'Low stakes, warm hearths, gentle trouble.' },
]

const SENSORY = 'Sensory'
const FACTIONS = 'Factions'
const CONFLICT = 'Conflict'
const SECRETS = 'Secrets'
const SCENES = 'Scenes'

const GROUP_DESCRIPTIONS: Record<string, string> = {
    [SENSORY]: 'What scenes here look, sound, and feel like.',
    [FACTIONS]: 'Powers that shape this place.',
    [CONFLICT]: "What's under pressure right now.",
    [SECRETS]: 'Hidden truths and when they surface.',
    [SCENES]: 'What can happen here.',
}

const bind = (group: string, key: string) => ({ group, key, groupDescription: GROUP_DESCRIPTIONS[group] })

export const WORLD_FIELDS: CardFieldDefinition[] = [
    {
        id: 'sensory.sights',
        label: 'Sights',
        helper: 'What the camera lands on first — concrete images the AI reuses in narration.',
        input: 'text',
        exampleHint: 'Bridges of ship-timber; bell towers leaning over green water.',
        defaultActive: true,
        binding: bind(SENSORY, 'Sights'),
    },
    {
        id: 'sensory.sounds',
        label: 'Sounds',
        helper: 'The ambient soundtrack — sound makes scenes feel inhabited.',
        input: 'text',
        exampleHint: 'Fog bells, gull-cry, oars in the dark.',
        defaultActive: true,
        binding: bind(SENSORY, 'Sounds'),
    },
    {
        id: 'sensory.smells',
        label: 'Smells & air',
        helper: 'Smell is the fastest mood-setter the AI has.',
        input: 'text',
        exampleHint: 'Salt, tar, kelp drying on rooftops.',
        binding: bind(SENSORY, 'Smells & Air'),
    },
    {
        id: 'sensory.weather',
        label: 'Weather & light',
        helper: 'Default weather and light tell the AI how every new scene opens.',
        input: 'text',
        exampleHint: 'Fog until noon; bruised-gold evenings; storms arrive unannounced.',
        binding: bind(SENSORY, 'Weather & Light'),
    },
    {
        id: 'factions.ruling',
        label: 'Ruling power',
        helper: "Who's in charge — an authority the AI can invoke, obey, or defy.",
        input: 'text',
        exampleHint: 'The Tidecourt — judges who rule from a barge that never docks.',
        defaultActive: true,
        binding: bind(FACTIONS, 'Ruling Power'),
    },
    {
        id: 'factions.rival',
        label: 'Rival power',
        helper: 'Who contests them — two powers in tension generate scenes on their own.',
        input: 'text',
        exampleHint: 'The Saltborn Guild, who own every ferry and every secret carried on one.',
        defaultActive: true,
        binding: bind(FACTIONS, 'Rival Power'),
    },
    {
        id: 'factions.wildcard',
        label: 'Wildcard',
        helper: 'A third force nobody controls — lets the AI surprise without breaking the setting.',
        input: 'text',
        exampleHint: 'The Bellkeepers, a silent order that answers only to the fog.',
        binding: bind(FACTIONS, 'Wildcard'),
    },
    {
        id: 'conflict.active',
        label: 'Active conflict',
        helper: "What's being fought over right now — a live conflict gives every scene a current.",
        input: 'text',
        exampleHint: 'Three islands have stopped paying the tide-tax, and the Tidecourt barge is sailing toward them.',
        defaultActive: true,
        binding: bind(CONFLICT, 'Active Conflict'),
    },
    {
        id: 'conflict.scarcity',
        label: 'Scarcity',
        helper: "What there isn't enough of — scarcity prices every favor the players ask.",
        input: 'text',
        exampleHint: 'Fresh water; it rains plenty, but the cisterns belong to the Guild.',
        binding: bind(CONFLICT, 'Scarcity'),
    },
    {
        id: 'conflict.changing',
        label: "What's changing",
        helper: "What's about to shift — momentum the AI can advance when scenes stall.",
        input: 'text',
        exampleHint: 'The fog comes earlier each day, and this year it whispers.',
        binding: bind(CONFLICT, "What's Changing"),
    },
    {
        id: 'secrets.truth',
        label: 'Hidden truth',
        helper: "Something true that isn't obvious — buried treasure for the AI to pay out.",
        input: 'text',
        exampleHint: "The islands aren't sinking — something beneath is pulling them down, gently, on purpose.",
        binding: bind(SECRETS, 'Hidden Truth'),
    },
    {
        id: 'secrets.who',
        label: 'Who knows',
        helper: 'Who could leak it — secrets enter play through people.',
        input: 'text',
        exampleHint: 'The oldest Bellkeeper, and one drowned ferryman who still talks.',
        binding: bind(SECRETS, 'Who Knows'),
    },
    {
        id: 'secrets.reveal',
        label: 'Reveal condition',
        helper: 'When the AI is allowed to surface the secret — without this it stays buried or leaks at random.',
        input: 'text',
        exampleHint: 'If anyone dives beneath the Ninth Isle, or rings a fog bell underwater.',
        binding: bind(SECRETS, 'Reveal Condition'),
    },
    {
        id: 'scenes.todo',
        label: 'Things to do',
        helper: 'Player-facing activities — what adventures this place naturally offers.',
        input: 'text',
        exampleHint: 'Bid for ferry routes, dive old ruins between tides, carry messages no one else will.',
        defaultActive: true,
        binding: bind(SCENES, 'Things to Do'),
    },
    {
        id: 'scenes.landmarks',
        label: 'Landmarks',
        helper: 'Named places the AI can set scenes at — names make a world quotable.',
        input: 'text',
        exampleHint: "The Tidecourt barge; the Drowned Cathedral; the Ninth Isle's silent bell.",
        binding: bind(SCENES, 'Landmarks'),
    },
    {
        id: 'scenes.dangers',
        label: 'Dangers',
        helper: 'What can hurt people here — danger gives scenes teeth without needing a villain.',
        input: 'text',
        exampleHint: 'Riptide alleys at tide-turn; bell-fog that returns ships empty.',
        binding: bind(SCENES, 'Dangers'),
    },
]

export const WORLD_SECTIONS: GuidedSectionDefinition[] = [
    {
        id: 'identity',
        icon: Globe,
        title: 'Identity',
        description: "Name, scale, and the genre promise you're making.",
        fieldIds: [],
    },
    {
        id: 'overview',
        icon: ScrollText,
        title: 'Overview',
        description: "The AI's standing picture of this place.",
        fieldIds: [],
    },
    {
        id: 'atmosphere',
        icon: CloudMoon,
        title: 'Atmosphere',
        description: 'What scenes here look, sound, and smell like.',
        fieldIds: ['sensory.sights', 'sensory.sounds', 'sensory.smells', 'sensory.weather'],
    },
    {
        id: 'powers',
        icon: Crown,
        title: 'Powers & People',
        description: 'Who rules, who resists, who surprises.',
        fieldIds: ['factions.ruling', 'factions.rival', 'factions.wildcard'],
    },
    {
        id: 'pressure',
        icon: Flame,
        title: 'Pressure',
        description: 'The live conflict that gives every scene a current.',
        fieldIds: ['conflict.active', 'conflict.scarcity', 'conflict.changing'],
    },
    {
        id: 'secrets',
        icon: KeyRound,
        title: 'Hidden Truths',
        description: "What's true but not obvious — and when it may surface.",
        fieldIds: ['secrets.truth', 'secrets.who', 'secrets.reveal'],
    },
    {
        id: 'ground',
        icon: Map,
        title: 'On the Ground',
        description: 'What players can actually do and visit here.',
        fieldIds: ['scenes.todo', 'scenes.landmarks', 'scenes.dangers'],
    },
    {
        id: 'details',
        icon: Layers,
        title: 'Details',
        description: 'Quick facts and free-form groups — add only what matters.',
        fieldIds: [],
    },
    {
        id: 'triggers',
        icon: Tags,
        title: 'Activation',
        description: 'The names that summon this world into a scene.',
        fieldIds: [],
    },
]
