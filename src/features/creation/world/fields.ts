/**
 * World guided-field registry — built for scene-setting. The `(group, key)`
 * bindings are the round-trip contract with saved cards: do not rename.
 *
 * Option `value`s and `(group, key)` bindings are the saved-card data contract
 * and are never localized; option `description`s, field labels/helpers, and
 * section copy resolve through the threaded `t`.
 */
import { CloudMoon, Crown, Flame, Globe, KeyRound, Layers, Map, ScrollText, Tags } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { SelectOption } from '@/ui/primitives'
import { CUSTOM_WORLD_PLACE_TYPE, WORLD_PLACE_TYPE_OPTIONS } from '@/shared'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'

/** The Setting/Place type mirror — `place_type` is dual-written here so it
 * survives the backend (whose World model drops the first-class field). The
 * `group`/`key` are saved-card data; the description resolves through `t`. */
export const PLACE_TYPE_MIRROR = {
    group: 'Setting',
    key: 'Place type',
} as const

/** The Place type mirror with its description resolved through `t`. */
export function placeTypeMirror(t: TFunction) {
    return { ...PLACE_TYPE_MIRROR, groupDescription: t('creation.world.placeTypeMirror') }
}

const PLACE_TYPE_DESCRIPTION_KEYS: Record<string, string> = {
    world: 'creation.world.options.placeType.world',
    place: 'creation.world.options.placeType.place',
    continent: 'creation.world.options.placeType.continent',
    country: 'creation.world.options.placeType.country',
    region: 'creation.world.options.placeType.region',
    city: 'creation.world.options.placeType.city',
    settlement: 'creation.world.options.placeType.settlement',
    landmark: 'creation.world.options.placeType.landmark',
    plane: 'creation.world.options.placeType.plane',
}

/** Existing shared place types, enriched with per-option example descriptions. */
export function getPlaceTypeSelectOptions(t: TFunction): SelectOption[] {
    return [
        ...WORLD_PLACE_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            description: PLACE_TYPE_DESCRIPTION_KEYS[option.value] ? t(PLACE_TYPE_DESCRIPTION_KEYS[option.value]) : undefined,
        })),
        { value: CUSTOM_WORLD_PLACE_TYPE, label: t('creation.world.options.placeType.customLabel'), description: t('creation.world.options.placeType.custom') },
    ]
}

const GENRE_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'High Fantasy', descriptionKey: 'creation.world.options.genre.highFantasy' },
    { value: 'Dark Fantasy', descriptionKey: 'creation.world.options.genre.darkFantasy' },
    { value: 'Gothic Horror', descriptionKey: 'creation.world.options.genre.gothicHorror' },
    { value: 'Cosmic Horror', descriptionKey: 'creation.world.options.genre.cosmicHorror' },
    { value: 'Sci-Fi', descriptionKey: 'creation.world.options.genre.sciFi' },
    { value: 'Cyberpunk', descriptionKey: 'creation.world.options.genre.cyberpunk' },
    { value: 'Steampunk', descriptionKey: 'creation.world.options.genre.steampunk' },
    { value: 'Solarpunk', descriptionKey: 'creation.world.options.genre.solarpunk' },
    { value: 'Post-Apocalyptic', descriptionKey: 'creation.world.options.genre.postApocalyptic' },
    { value: 'Urban Fantasy', descriptionKey: 'creation.world.options.genre.urbanFantasy' },
    { value: 'Historical', descriptionKey: 'creation.world.options.genre.historical' },
    { value: 'Mythic', descriptionKey: 'creation.world.options.genre.mythic' },
    { value: 'Fairy Tale', descriptionKey: 'creation.world.options.genre.fairyTale' },
    { value: 'Political Intrigue', descriptionKey: 'creation.world.options.genre.politicalIntrigue' },
    { value: 'Cozy', descriptionKey: 'creation.world.options.genre.cozy' },
]

export function getGenreOptions(t: TFunction): SelectOption[] {
    return GENRE_OPTION_DEFS.map((def) => ({ value: def.value, label: def.value, description: t(def.descriptionKey) }))
}

const SENSORY = 'Sensory'
const FACTIONS = 'Factions'
const CONFLICT = 'Conflict'
const SECRETS = 'Secrets'
const SCENES = 'Scenes'

const groupDescription = (group: string, t: TFunction): string => {
    switch (group) {
        case SENSORY:
            return t('creation.world.groups.sensory')
        case FACTIONS:
            return t('creation.world.groups.factions')
        case CONFLICT:
            return t('creation.world.groups.conflict')
        case SECRETS:
            return t('creation.world.groups.secrets')
        case SCENES:
            return t('creation.world.groups.scenes')
        default:
            return ''
    }
}

const bind = (group: string, key: string, t: TFunction) => ({ group, key, groupDescription: groupDescription(group, t) })

export function getWorldFields(t: TFunction): CardFieldDefinition[] {
    return [
        {
            id: 'sensory.sights',
            label: t('creation.world.fields.sights.label'),
            helper: t('creation.world.fields.sights.helper'),
            input: 'text',
            exampleHint: 'Bridges of ship-timber; bell towers leaning over green water.',
            defaultActive: true,
            binding: bind(SENSORY, 'Sights', t),
        },
        {
            id: 'sensory.sounds',
            label: t('creation.world.fields.sounds.label'),
            helper: t('creation.world.fields.sounds.helper'),
            input: 'text',
            exampleHint: 'Fog bells, gull-cry, oars in the dark.',
            defaultActive: true,
            binding: bind(SENSORY, 'Sounds', t),
        },
        {
            id: 'sensory.smells',
            label: t('creation.world.fields.smells.label'),
            helper: t('creation.world.fields.smells.helper'),
            input: 'text',
            exampleHint: 'Salt, tar, kelp drying on rooftops.',
            binding: bind(SENSORY, 'Smells & Air', t),
        },
        {
            id: 'sensory.weather',
            label: t('creation.world.fields.weather.label'),
            helper: t('creation.world.fields.weather.helper'),
            input: 'text',
            exampleHint: 'Fog until noon; bruised-gold evenings; storms arrive unannounced.',
            binding: bind(SENSORY, 'Weather & Light', t),
        },
        {
            id: 'factions.ruling',
            label: t('creation.world.fields.ruling.label'),
            helper: t('creation.world.fields.ruling.helper'),
            input: 'text',
            exampleHint: 'The Tidecourt — judges who rule from a barge that never docks.',
            defaultActive: true,
            binding: bind(FACTIONS, 'Ruling Power', t),
        },
        {
            id: 'factions.rival',
            label: t('creation.world.fields.rival.label'),
            helper: t('creation.world.fields.rival.helper'),
            input: 'text',
            exampleHint: 'The Saltborn Guild, who own every ferry and every secret carried on one.',
            defaultActive: true,
            binding: bind(FACTIONS, 'Rival Power', t),
        },
        {
            id: 'factions.wildcard',
            label: t('creation.world.fields.wildcard.label'),
            helper: t('creation.world.fields.wildcard.helper'),
            input: 'text',
            exampleHint: 'The Bellkeepers, a silent order that answers only to the fog.',
            binding: bind(FACTIONS, 'Wildcard', t),
        },
        {
            id: 'conflict.active',
            label: t('creation.world.fields.active.label'),
            helper: t('creation.world.fields.active.helper'),
            input: 'text',
            exampleHint: 'Three islands have stopped paying the tide-tax, and the Tidecourt barge is sailing toward them.',
            defaultActive: true,
            binding: bind(CONFLICT, 'Active Conflict', t),
        },
        {
            id: 'conflict.scarcity',
            label: t('creation.world.fields.scarcity.label'),
            helper: t('creation.world.fields.scarcity.helper'),
            input: 'text',
            exampleHint: 'Fresh water; it rains plenty, but the cisterns belong to the Guild.',
            binding: bind(CONFLICT, 'Scarcity', t),
        },
        {
            id: 'conflict.changing',
            label: t('creation.world.fields.changing.label'),
            helper: t('creation.world.fields.changing.helper'),
            input: 'text',
            exampleHint: 'The fog comes earlier each day, and this year it whispers.',
            binding: bind(CONFLICT, "What's Changing", t),
        },
        {
            id: 'secrets.truth',
            label: t('creation.world.fields.truth.label'),
            helper: t('creation.world.fields.truth.helper'),
            input: 'text',
            exampleHint: "The islands aren't sinking — something beneath is pulling them down, gently, on purpose.",
            binding: bind(SECRETS, 'Hidden Truth', t),
        },
        {
            id: 'secrets.who',
            label: t('creation.world.fields.who.label'),
            helper: t('creation.world.fields.who.helper'),
            input: 'text',
            exampleHint: 'The oldest Bellkeeper, and one drowned ferryman who still talks.',
            binding: bind(SECRETS, 'Who Knows', t),
        },
        {
            id: 'secrets.reveal',
            label: t('creation.world.fields.reveal.label'),
            helper: t('creation.world.fields.reveal.helper'),
            input: 'text',
            exampleHint: 'If anyone dives beneath the Ninth Isle, or rings a fog bell underwater.',
            binding: bind(SECRETS, 'Reveal Condition', t),
        },
        {
            id: 'scenes.todo',
            label: t('creation.world.fields.todo.label'),
            helper: t('creation.world.fields.todo.helper'),
            input: 'text',
            exampleHint: 'Bid for ferry routes, dive old ruins between tides, carry messages no one else will.',
            defaultActive: true,
            binding: bind(SCENES, 'Things to Do', t),
        },
        {
            id: 'scenes.landmarks',
            label: t('creation.world.fields.landmarks.label'),
            helper: t('creation.world.fields.landmarks.helper'),
            input: 'text',
            exampleHint: "The Tidecourt barge; the Drowned Cathedral; the Ninth Isle's silent bell.",
            binding: bind(SCENES, 'Landmarks', t),
        },
        {
            id: 'scenes.dangers',
            label: t('creation.world.fields.dangers.label'),
            helper: t('creation.world.fields.dangers.helper'),
            input: 'text',
            exampleHint: 'Riptide alleys at tide-turn; bell-fog that returns ships empty.',
            binding: bind(SCENES, 'Dangers', t),
        },
    ]
}

export function getWorldSections(t: TFunction): GuidedSectionDefinition[] {
    return [
        {
            id: 'identity',
            icon: Globe,
            title: t('creation.world.sections.identity.title'),
            description: t('creation.world.sections.identity.description'),
            fieldIds: [],
        },
        {
            id: 'overview',
            icon: ScrollText,
            title: t('creation.world.sections.overview.title'),
            description: t('creation.world.sections.overview.description'),
            fieldIds: [],
        },
        {
            id: 'atmosphere',
            icon: CloudMoon,
            title: t('creation.world.sections.atmosphere.title'),
            description: t('creation.world.sections.atmosphere.description'),
            fieldIds: ['sensory.sights', 'sensory.sounds', 'sensory.smells', 'sensory.weather'],
        },
        {
            id: 'powers',
            icon: Crown,
            title: t('creation.world.sections.powers.title'),
            description: t('creation.world.sections.powers.description'),
            fieldIds: ['factions.ruling', 'factions.rival', 'factions.wildcard'],
        },
        {
            id: 'pressure',
            icon: Flame,
            title: t('creation.world.sections.pressure.title'),
            description: t('creation.world.sections.pressure.description'),
            fieldIds: ['conflict.active', 'conflict.scarcity', 'conflict.changing'],
        },
        {
            id: 'secrets',
            icon: KeyRound,
            title: t('creation.world.sections.secrets.title'),
            description: t('creation.world.sections.secrets.description'),
            fieldIds: ['secrets.truth', 'secrets.who', 'secrets.reveal'],
        },
        {
            id: 'ground',
            icon: Map,
            title: t('creation.world.sections.ground.title'),
            description: t('creation.world.sections.ground.description'),
            fieldIds: ['scenes.todo', 'scenes.landmarks', 'scenes.dangers'],
        },
        {
            id: 'details',
            icon: Layers,
            title: t('creation.world.sections.details.title'),
            description: t('creation.world.sections.details.description'),
            fieldIds: [],
        },
        {
            id: 'triggers',
            icon: Tags,
            title: t('creation.world.sections.triggers.title'),
            description: t('creation.world.sections.triggers.description'),
            fieldIds: [],
        },
    ]
}
