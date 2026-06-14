/**
 * Adventure guided-field registry — built as the opening contract: the exact
 * first image, the stakes and clock, who pushes back, and how the AI game
 * master should run it. The `(group, key)` bindings are the round-trip
 * contract with saved cards: do not rename.
 *
 * Option `value`s and `(group, key)` bindings are the saved-card data contract
 * and are never localized; option `description`s, field labels/helpers, and
 * section copy resolve through the threaded `t`.
 */
import {
    Clapperboard,
    Globe,
    Hourglass,
    ScrollText,
    Sunrise,
    Swords,
    Tags,
    Target,
    UserCircle,
    Users,
} from 'lucide-react'
import type { TFunction } from 'i18next'
import type { SelectOption } from '@/ui/primitives'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'

const STAKES_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'A life in the balance', descriptionKey: 'creation.adventure.options.stakes.life' },
    { value: "A community's survival", descriptionKey: 'creation.adventure.options.stakes.community' },
    { value: 'A dangerous secret', descriptionKey: 'creation.adventure.options.stakes.secret' },
    { value: 'Power changing hands', descriptionKey: 'creation.adventure.options.stakes.power' },
    { value: 'A soul or a bond', descriptionKey: 'creation.adventure.options.stakes.soul' },
    { value: 'Personal honor', descriptionKey: 'creation.adventure.options.stakes.honor' },
    { value: "Someone's freedom", descriptionKey: 'creation.adventure.options.stakes.freedom' },
    { value: 'The world itself', descriptionKey: 'creation.adventure.options.stakes.world' },
]

const CLOCK_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Dawn deadline', descriptionKey: 'creation.adventure.options.clock.dawn' },
    { value: 'Three days', descriptionKey: 'creation.adventure.options.clock.threeDays' },
    { value: 'The festival ends', descriptionKey: 'creation.adventure.options.clock.festival' },
    { value: 'Pursuers closing', descriptionKey: 'creation.adventure.options.clock.pursuers' },
    { value: 'Supplies running out', descriptionKey: 'creation.adventure.options.clock.supplies' },
    { value: 'The ritual advances', descriptionKey: 'creation.adventure.options.clock.ritual' },
    { value: 'A verdict approaches', descriptionKey: 'creation.adventure.options.clock.verdict' },
]

const TONE_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Heroic', descriptionKey: 'creation.adventure.options.tone.heroic' },
    { value: 'Grim', descriptionKey: 'creation.adventure.options.tone.grim' },
    { value: 'Eerie', descriptionKey: 'creation.adventure.options.tone.eerie' },
    { value: 'Cozy', descriptionKey: 'creation.adventure.options.tone.cozy' },
    { value: 'Mischievous', descriptionKey: 'creation.adventure.options.tone.mischievous' },
    { value: 'Romantic', descriptionKey: 'creation.adventure.options.tone.romantic' },
    { value: 'Epic', descriptionKey: 'creation.adventure.options.tone.epic' },
    { value: 'Noir', descriptionKey: 'creation.adventure.options.tone.noir' },
    { value: 'Whimsical', descriptionKey: 'creation.adventure.options.tone.whimsical' },
]

const PACING_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Slow burn', descriptionKey: 'creation.adventure.options.pacing.slowBurn' },
    { value: 'Steady', descriptionKey: 'creation.adventure.options.pacing.steady' },
    { value: 'Breakneck', descriptionKey: 'creation.adventure.options.pacing.breakneck' },
]

const NARRATION_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Cinematic', descriptionKey: 'creation.adventure.options.narration.cinematic' },
    { value: 'Literary', descriptionKey: 'creation.adventure.options.narration.literary' },
    { value: 'Sparse', descriptionKey: 'creation.adventure.options.narration.sparse' },
    { value: 'Conversational', descriptionKey: 'creation.adventure.options.narration.conversational' },
]

const toOptions = (defs: { value: string; descriptionKey: string }[], t: TFunction): SelectOption[] =>
    defs.map((def) => ({ value: def.value, label: def.value, description: t(def.descriptionKey) }))

export function getStakesOptions(t: TFunction): SelectOption[] {
    return toOptions(STAKES_OPTION_DEFS, t)
}

const OPENING = 'Opening'
const STAKES = 'Stakes'
const OPPOSITION = 'Opposition'
const SCENES = 'Scenes'
const DIRECTION = 'Direction'

const groupDescription = (group: string, t: TFunction): string => {
    switch (group) {
        case OPENING:
            return t('creation.adventure.groups.opening')
        case STAKES:
            return t('creation.adventure.groups.stakes')
        case OPPOSITION:
            return t('creation.adventure.groups.opposition')
        case SCENES:
            return t('creation.adventure.groups.scenes')
        case DIRECTION:
            return t('creation.adventure.groups.direction')
        default:
            return ''
    }
}

const bind = (group: string, key: string, t: TFunction) => ({ group, key, groupDescription: groupDescription(group, t) })

export function getAdventureFields(t: TFunction): CardFieldDefinition[] {
    return [
        {
            id: 'opening.scene',
            label: t('creation.adventure.fields.scene.label'),
            helper: t('creation.adventure.fields.scene.helper'),
            input: 'textarea',
            rows: 3,
            exampleHint:
                'Rain on the harbor steps at midnight. The letter in your hand is coming apart, but the wax seal — a crowned serpent — is intact.',
            defaultActive: true,
            binding: bind(OPENING, 'Opening Scene', t),
        },
        {
            id: 'opening.incident',
            label: t('creation.adventure.fields.incident.label'),
            helper: t('creation.adventure.fields.incident.helper'),
            input: 'text',
            exampleHint: 'The courier is dead before he reaches the corner, and no one else is on the street.',
            defaultActive: true,
            binding: bind(OPENING, 'Inciting Incident', t),
        },
        {
            id: 'opening.choice',
            label: t('creation.adventure.fields.choice.label'),
            helper: t('creation.adventure.fields.choice.helper'),
            input: 'text',
            exampleHint: 'Read the letter here under the lamp, or vanish first and read it safe — the watch is coming either way.',
            binding: bind(OPENING, 'First Choice', t),
        },
        {
            id: 'stakes.what',
            label: t('creation.adventure.fields.what.label'),
            helper: t('creation.adventure.fields.what.helper'),
            input: 'suggest',
            options: getStakesOptions(t),
            exampleHint: "If the letter's names go public, every safehouse in the city burns by week's end.",
            defaultActive: true,
            binding: bind(STAKES, "What's at Stake", t),
        },
        {
            id: 'stakes.clock',
            label: t('creation.adventure.fields.clock.label'),
            helper: t('creation.adventure.fields.clock.helper'),
            input: 'suggest',
            options: toOptions(CLOCK_OPTION_DEFS, t),
            exampleHint: 'The names on the list are being hunted one by one — two are already gone.',
            defaultActive: true,
            binding: bind(STAKES, 'Ticking Clock', t),
        },
        {
            id: 'stakes.fail',
            label: t('creation.adventure.fields.fail.label'),
            helper: t('creation.adventure.fields.fail.helper'),
            input: 'text',
            exampleHint:
                'The serpent court takes the harbor quarter, and survivors learn your name was on the list of those who could have stopped it.',
            defaultActive: true,
            binding: bind(STAKES, 'If They Fail', t),
        },
        {
            id: 'opposition.antagonist',
            label: t('creation.adventure.fields.antagonist.label'),
            helper: t('creation.adventure.fields.antagonist.helper'),
            input: 'text',
            exampleHint: 'Mother Coil, spymistress of the serpent court, who never threatens twice.',
            defaultActive: true,
            binding: bind(OPPOSITION, 'Antagonist', t),
        },
        {
            id: 'opposition.goal',
            label: t('creation.adventure.fields.goal.label'),
            helper: t('creation.adventure.fields.goal.helper'),
            input: 'text',
            exampleHint: 'To burn the list and everyone who has read it — which now includes you.',
            defaultActive: true,
            binding: bind(OPPOSITION, 'Their Goal', t),
        },
        {
            id: 'opposition.move',
            label: t('creation.adventure.fields.move.label'),
            helper: t('creation.adventure.fields.move.helper'),
            input: 'text',
            exampleHint: 'Tonight: the docks safehouse. Tomorrow: the chapel. She saves you for last.',
            binding: bind(OPPOSITION, 'Their Next Move', t),
        },
        {
            id: 'scenes.beats',
            label: t('creation.adventure.fields.beats.label'),
            helper: t('creation.adventure.fields.beats.helper'),
            input: 'textarea',
            rows: 3,
            exampleHint:
                "The courier's empty boots; a parley under the lighthouse; the archivist who knows the seal; the list's final name.",
            binding: bind(SCENES, 'Possible Beats', t),
        },
        {
            id: 'scenes.places',
            label: t('creation.adventure.fields.places.label'),
            helper: t('creation.adventure.fields.places.helper'),
            input: 'text',
            exampleHint: 'The fog docks; the Counting House; the chapel of unclaimed bodies.',
            binding: bind(SCENES, 'Likely Places', t),
        },
        {
            id: 'direction.tone',
            label: t('creation.adventure.fields.tone.label'),
            helper: t('creation.adventure.fields.tone.helper'),
            input: 'suggest',
            options: toOptions(TONE_OPTION_DEFS, t),
            exampleHint: 'Noir',
            defaultActive: true,
            binding: bind(DIRECTION, 'Tone', t),
        },
        {
            id: 'direction.pacing',
            label: t('creation.adventure.fields.pacing.label'),
            helper: t('creation.adventure.fields.pacing.helper'),
            input: 'select',
            options: toOptions(PACING_OPTION_DEFS, t),
            binding: bind(DIRECTION, 'Pacing', t),
        },
        {
            id: 'direction.narration',
            label: t('creation.adventure.fields.narration.label'),
            helper: t('creation.adventure.fields.narration.helper'),
            input: 'suggest',
            options: toOptions(NARRATION_OPTION_DEFS, t),
            exampleHint: 'Cinematic',
            binding: bind(DIRECTION, 'Narration Style', t),
        },
        {
            id: 'direction.agency',
            label: t('creation.adventure.fields.agency.label'),
            helper: t('creation.adventure.fields.agency.helper'),
            input: 'textarea',
            rows: 3,
            exampleHint:
                "Never decide my persona's actions, words, or feelings. End turns on an open situation or a question. Let my failures stand.",
            binding: bind(DIRECTION, 'Player Agency', t),
        },
    ]
}

export function getAdventureSections(t: TFunction): GuidedSectionDefinition[] {
    return [
        {
            id: 'scenario',
            icon: ScrollText,
            title: t('creation.adventure.sections.scenario.title'),
            description: t('creation.adventure.sections.scenario.description'),
            fieldIds: [],
        },
        {
            id: 'opening',
            icon: Sunrise,
            title: t('creation.adventure.sections.opening.title'),
            description: t('creation.adventure.sections.opening.description'),
            fieldIds: ['opening.scene', 'opening.incident', 'opening.choice'],
        },
        {
            id: 'stakes',
            icon: Hourglass,
            title: t('creation.adventure.sections.stakes.title'),
            description: t('creation.adventure.sections.stakes.description'),
            fieldIds: ['stakes.what', 'stakes.clock', 'stakes.fail'],
        },
        {
            id: 'opposition',
            icon: Swords,
            title: t('creation.adventure.sections.opposition.title'),
            description: t('creation.adventure.sections.opposition.description'),
            fieldIds: ['opposition.antagonist', 'opposition.goal', 'opposition.move'],
        },
        {
            id: 'cast',
            icon: Users,
            title: t('creation.adventure.sections.cast.title'),
            description: t('creation.adventure.sections.cast.description'),
            fieldIds: [],
        },
        {
            id: 'persona',
            icon: UserCircle,
            title: t('creation.adventure.sections.persona.title'),
            description: t('creation.adventure.sections.persona.description'),
            fieldIds: [],
        },
        {
            id: 'world',
            icon: Globe,
            title: t('creation.adventure.sections.world.title'),
            description: t('creation.adventure.sections.world.description'),
            fieldIds: [],
        },
        {
            id: 'objectives',
            icon: Target,
            title: t('creation.adventure.sections.objectives.title'),
            description: t('creation.adventure.sections.objectives.description'),
            fieldIds: ['scenes.beats', 'scenes.places'],
        },
        {
            id: 'direction',
            icon: Clapperboard,
            title: t('creation.adventure.sections.direction.title'),
            description: t('creation.adventure.sections.direction.description'),
            fieldIds: ['direction.tone', 'direction.pacing', 'direction.narration', 'direction.agency'],
        },
        {
            id: 'triggers',
            icon: Tags,
            title: t('creation.adventure.sections.triggers.title'),
            description: t('creation.adventure.sections.triggers.description'),
            fieldIds: [],
        },
    ]
}
