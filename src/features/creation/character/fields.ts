/**
 * Character guided-field registry — built for portrayal. The `(group, key)`
 * bindings below are the round-trip contract with saved cards: do not rename.
 *
 * The registry is role-adaptive: labels/helpers shift for user personas, and
 * `roles`/`defaultActive` drive which fields show per role. Field ids stay
 * constant across roles so values survive toggling.
 *
 * Option `value`s and `(group, key)` bindings are the saved-card data contract
 * and are never localized; option `description`s, field labels/helpers, and
 * section copy resolve through the threaded `t`.
 */
import { Flame, HeartHandshake, Quote, ScrollText, Shield, Swords, Tags, User } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { SelectOption } from '@/ui/primitives'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'
import type { CharacterRole } from '@/shared/types/character.types'

/** Race options: `value` is the saved data; `descriptionKey` resolves flavor copy. */
const RACE_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Human', descriptionKey: 'creation.character.options.race.human' },
    { value: 'Elf', descriptionKey: 'creation.character.options.race.elf' },
    { value: 'Dwarf', descriptionKey: 'creation.character.options.race.dwarf' },
    { value: 'Halfling', descriptionKey: 'creation.character.options.race.halfling' },
    { value: 'Orc', descriptionKey: 'creation.character.options.race.orc' },
    { value: 'Goblin', descriptionKey: 'creation.character.options.race.goblin' },
    { value: 'Tiefling', descriptionKey: 'creation.character.options.race.tiefling' },
    { value: 'Dragonkin', descriptionKey: 'creation.character.options.race.dragonkin' },
    { value: 'Fae', descriptionKey: 'creation.character.options.race.fae' },
    { value: 'Vampire', descriptionKey: 'creation.character.options.race.vampire' },
    { value: 'Shapeshifter', descriptionKey: 'creation.character.options.race.shapeshifter' },
    { value: 'Undead', descriptionKey: 'creation.character.options.race.undead' },
    { value: 'Android / Construct', descriptionKey: 'creation.character.options.race.android' },
    { value: 'Alien', descriptionKey: 'creation.character.options.race.alien' },
    { value: 'Spirit', descriptionKey: 'creation.character.options.race.spirit' },
]

const ARCHETYPE_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Companion', descriptionKey: 'creation.character.options.archetype.companion' },
    { value: 'Mentor', descriptionKey: 'creation.character.options.archetype.mentor' },
    { value: 'Guardian', descriptionKey: 'creation.character.options.archetype.guardian' },
    { value: 'Trickster', descriptionKey: 'creation.character.options.archetype.trickster' },
    { value: 'Rival', descriptionKey: 'creation.character.options.archetype.rival' },
    { value: 'Villain', descriptionKey: 'creation.character.options.archetype.villain' },
    { value: 'Rogue', descriptionKey: 'creation.character.options.archetype.rogue' },
    { value: 'Sage', descriptionKey: 'creation.character.options.archetype.sage' },
    { value: 'Innocent', descriptionKey: 'creation.character.options.archetype.innocent' },
    { value: 'Leader', descriptionKey: 'creation.character.options.archetype.leader' },
    { value: 'Outcast', descriptionKey: 'creation.character.options.archetype.outcast' },
    { value: 'Wildcard', descriptionKey: 'creation.character.options.archetype.wildcard' },
]

const SPEECH_STYLE_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Gruff & warm', descriptionKey: 'creation.character.options.speech.gruffWarm' },
    { value: 'Menacingly polite', descriptionKey: 'creation.character.options.speech.menacinglyPolite' },
    { value: 'Playful & teasing', descriptionKey: 'creation.character.options.speech.playfulTeasing' },
    { value: 'Formal & archaic', descriptionKey: 'creation.character.options.speech.formalArchaic' },
    { value: 'Scholarly', descriptionKey: 'creation.character.options.speech.scholarly' },
    { value: 'Poetic', descriptionKey: 'creation.character.options.speech.poetic' },
    { value: 'Terse', descriptionKey: 'creation.character.options.speech.terse' },
    { value: 'Street-sharp', descriptionKey: 'creation.character.options.speech.streetSharp' },
    { value: 'Warm & rambling', descriptionKey: 'creation.character.options.speech.warmRambling' },
    { value: 'Cold & precise', descriptionKey: 'creation.character.options.speech.coldPrecise' },
    { value: 'Shy & halting', descriptionKey: 'creation.character.options.speech.shyHalting' },
    { value: 'Theatrical', descriptionKey: 'creation.character.options.speech.theatrical' },
]

const toOptions = (defs: { value: string; descriptionKey: string }[], t: TFunction): SelectOption[] =>
    defs.map((def) => ({ value: def.value, label: def.value, description: t(def.descriptionKey) }))

/** Race suggestions (used both inside the engine and on the first-class Race field). */
export function getRaceOptions(t: TFunction): SelectOption[] {
    return toOptions(RACE_OPTION_DEFS, t)
}

const PERSONALITY = 'Personality'
const VOICE = 'Voice'
const RELATIONSHIPS = 'Relationships'
const BOUNDARIES = 'Boundaries'

const groupDescription = (group: string, t: TFunction): string => {
    switch (group) {
        case PERSONALITY:
            return t('creation.character.groups.personality')
        case VOICE:
            return t('creation.character.groups.voice')
        case RELATIONSHIPS:
            return t('creation.character.groups.relationships')
        case BOUNDARIES:
            return t('creation.character.groups.boundaries')
        default:
            return ''
    }
}

const bind = (group: string, key: string, t: TFunction) => ({ group, key, groupDescription: groupDescription(group, t) })

/** The guided enrichment fields, adapted to the current card role. */
export function getCharacterFields(role: CharacterRole, t: TFunction): CardFieldDefinition[] {
    const persona = role === 'persona'
    return [
        {
            id: 'personality.archetype',
            label: t('creation.character.fields.archetype.label'),
            helper: t('creation.character.fields.archetype.helper'),
            input: 'suggest',
            options: toOptions(ARCHETYPE_OPTION_DEFS, t),
            exampleHint: 'Mentor',
            defaultActive: ['character'],
            binding: bind(PERSONALITY, 'Archetype', t),
        },
        {
            id: 'personality.motivation',
            label: persona ? t('creation.character.fields.motivation.labelPersona') : t('creation.character.fields.motivation.label'),
            helper: t('creation.character.fields.motivation.helper'),
            input: 'text',
            exampleHint: 'To buy back the family forge before winter, whatever it takes.',
            defaultActive: true,
            binding: bind(PERSONALITY, 'Motivation', t),
        },
        {
            id: 'personality.fear',
            label: t('creation.character.fields.fear.label'),
            helper: t('creation.character.fields.fear.helper'),
            input: 'text',
            exampleHint: "Open water. She'll ride three days around a lake and call it a shortcut.",
            defaultActive: ['character'],
            binding: bind(PERSONALITY, 'Fear', t),
        },
        {
            id: 'personality.secret',
            label: t('creation.character.fields.secret.label'),
            helper: t('creation.character.fields.secret.helper'),
            input: 'text',
            exampleHint: "The 'family' forge was won in a rigged card game she rigged herself.",
            defaultActive: ['character'],
            binding: bind(PERSONALITY, 'Secret', t),
        },
        {
            id: 'personality.quirks',
            label: t('creation.character.fields.quirks.label'),
            helper: t('creation.character.fields.quirks.helper'),
            input: 'text',
            exampleHint: 'Hums while working; refuses to count aloud in front of strangers; feeds every stray.',
            binding: bind(PERSONALITY, 'Quirks', t),
        },
        {
            id: 'personality.values',
            label: t('creation.character.fields.values.label'),
            helper: t('creation.character.fields.values.helper'),
            input: 'text',
            exampleHint: 'A deal sealed by handshake is sacred; everything else is negotiable.',
            binding: bind(PERSONALITY, 'Values', t),
        },
        {
            id: 'personality.pressure',
            label: persona ? t('creation.character.fields.pressure.labelPersona') : t('creation.character.fields.pressure.label'),
            helper: persona
                ? t('creation.character.fields.pressure.helperPersona')
                : t('creation.character.fields.pressure.helper'),
            input: 'text',
            exampleHint: persona
                ? 'Jokes first, plans second, never shows the fear until after.'
                : "The debt collector arrives at the new moon, and he doesn't renegotiate.",
            defaultActive: ['persona'],
            binding: bind(PERSONALITY, 'Pressure', t),
        },
        {
            id: 'voice.speech',
            label: t('creation.character.fields.speech.label'),
            helper: t('creation.character.fields.speech.helper'),
            input: 'suggest',
            options: toOptions(SPEECH_STYLE_OPTION_DEFS, t),
            exampleHint: 'Gruff & warm',
            defaultActive: ['character'],
            binding: bind(VOICE, 'Speech Style', t),
        },
        {
            id: 'voice.catchphrase',
            label: t('creation.character.fields.catchphrase.label'),
            helper: t('creation.character.fields.catchphrase.helper'),
            input: 'text',
            exampleHint: '"Mend it or bury it."',
            roles: ['character'],
            binding: bind(VOICE, 'Catchphrase', t),
        },
        {
            id: 'voice.example',
            label: t('creation.character.fields.example.label'),
            helper: t('creation.character.fields.example.helper'),
            input: 'textarea',
            rows: 3,
            exampleHint:
                'Player: Can you fix it? / Lyra: *turns the blade over once* I can fix the steel. The man who broke it — that\'s your craft.',
            roles: ['character'],
            binding: bind(VOICE, 'Example Dialogue', t),
        },
        {
            id: 'voice.wont',
            label: t('creation.character.fields.wont.label'),
            helper: t('creation.character.fields.wont.helper'),
            input: 'text',
            exampleHint: 'Her years in the capital; anyone who asks gets a new subject and stronger tea.',
            roles: ['character'],
            binding: bind(VOICE, "Won't Discuss", t),
        },
        {
            id: 'ties.allies',
            label: t('creation.character.fields.allies.label'),
            helper: t('creation.character.fields.allies.helper'),
            input: 'text',
            exampleHint: 'Bren the dockmaster, who never asks why; her apprentice, who asks constantly.',
            defaultActive: ['character'],
            binding: bind(RELATIONSHIPS, 'Allies', t),
        },
        {
            id: 'ties.rivals',
            label: t('creation.character.fields.rivals.label'),
            helper: t('creation.character.fields.rivals.helper'),
            input: 'text',
            exampleHint: "Master Corvane of the smiths' guild, who remembers the card game.",
            binding: bind(RELATIONSHIPS, 'Rivals', t),
        },
        {
            id: 'ties.bonds',
            label: persona ? t('creation.character.fields.bonds.labelPersona') : t('creation.character.fields.bonds.label'),
            helper: t('creation.character.fields.bonds.helper'),
            input: 'text',
            exampleHint: 'Owes the smuggler queen a favor; would cross a war zone for her sister.',
            defaultActive: ['persona'],
            binding: bind(RELATIONSHIPS, 'Bonds', t),
        },
        {
            id: 'boundaries.agency',
            label: t('creation.character.fields.agency.label'),
            helper: t('creation.character.fields.agency.helper'),
            input: 'textarea',
            rows: 3,
            exampleHint:
                'Never write my dialogue, decisions, or emotions. Describe the world up to my skin and stop. Small reflexes (flinching, catching breath) are fine.',
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Player Agency', t),
        },
        {
            id: 'boundaries.address',
            label: t('creation.character.fields.address.label'),
            helper: t('creation.character.fields.address.helper'),
            input: 'text',
            exampleHint: "She/her. Characters call me 'Captain' in public, 'Mara' among friends.",
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Address & Pronouns', t),
        },
        {
            id: 'boundaries.lines',
            label: t('creation.character.fields.lines.label'),
            helper: t('creation.character.fields.lines.helper'),
            input: 'text',
            exampleHint: 'No harm to children, ever. Torture stays off-screen. Romance welcome; fade to black past kissing.',
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Lines & Veils', t),
        },
        {
            id: 'boundaries.skills',
            label: t('creation.character.fields.skills.label'),
            helper: t('creation.character.fields.skills.helper'),
            input: 'text',
            exampleHint: 'Excellent: sailing, knots, reading weather. Hopeless: horses, etiquette, holding her tongue.',
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Skills & Limits', t),
        },
        {
            id: 'boundaries.knownsecrets',
            label: t('creation.character.fields.knownsecrets.label'),
            helper: t('creation.character.fields.knownsecrets.helper'),
            input: 'text',
            exampleHint: "She knows the harbormaster's ledger is forged — and hasn't decided what to do about it.",
            roles: ['persona'],
            binding: bind(BOUNDARIES, 'Known Secrets', t),
        },
    ]
}

export interface CharacterSections {
    identity: GuidedSectionDefinition
    portrayal: GuidedSectionDefinition
    drives: GuidedSectionDefinition
    boundaries: GuidedSectionDefinition
    voice: GuidedSectionDefinition
    ties: GuidedSectionDefinition
    traits: GuidedSectionDefinition
    triggers: GuidedSectionDefinition
}

/** All sections in render order, adapted to role. Bespoke sections keep empty fieldIds. */
export function getCharacterSections(role: CharacterRole, t: TFunction): CharacterSections {
    const persona = role === 'persona'
    return {
        identity: {
            id: 'identity',
            icon: User,
            title: t('creation.character.sections.identity.title'),
            description: t('creation.character.sections.identity.description'),
            fieldIds: [],
        },
        portrayal: {
            id: 'portrayal',
            icon: ScrollText,
            title: persona ? t('creation.character.sections.portrayal.titlePersona') : t('creation.character.sections.portrayal.title'),
            description: persona
                ? t('creation.character.sections.portrayal.descriptionPersona')
                : t('creation.character.sections.portrayal.description'),
            fieldIds: [],
        },
        drives: {
            id: 'drives',
            icon: Flame,
            title: persona ? t('creation.character.sections.drives.titlePersona') : t('creation.character.sections.drives.title'),
            description: persona
                ? t('creation.character.sections.drives.descriptionPersona')
                : t('creation.character.sections.drives.description'),
            fieldIds: [
                'personality.archetype',
                'personality.motivation',
                'personality.fear',
                'personality.secret',
                'personality.quirks',
                'personality.values',
                'personality.pressure',
            ],
        },
        boundaries: {
            id: 'boundaries',
            icon: Shield,
            title: t('creation.character.sections.boundaries.title'),
            description: t('creation.character.sections.boundaries.description'),
            fieldIds: [
                'boundaries.agency',
                'boundaries.address',
                'boundaries.lines',
                'boundaries.skills',
                'boundaries.knownsecrets',
            ],
        },
        voice: {
            id: 'voice',
            icon: Quote,
            title: t('creation.character.sections.voice.title'),
            description: t('creation.character.sections.voice.description'),
            fieldIds: ['voice.speech', 'voice.catchphrase', 'voice.example', 'voice.wont'],
        },
        ties: {
            id: 'ties',
            icon: HeartHandshake,
            title: t('creation.character.sections.ties.title'),
            description: t('creation.character.sections.ties.description'),
            fieldIds: ['ties.allies', 'ties.rivals', 'ties.bonds'],
        },
        traits: {
            id: 'traits',
            icon: Swords,
            title: t('creation.character.sections.traits.title'),
            description: t('creation.character.sections.traits.description'),
            fieldIds: [],
        },
        triggers: {
            id: 'triggers',
            icon: Tags,
            title: t('creation.character.sections.triggers.title'),
            description: t('creation.character.sections.triggers.description'),
            fieldIds: [],
        },
    }
}
