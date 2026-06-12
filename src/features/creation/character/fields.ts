/**
 * Character guided-field registry — built for portrayal. The `(group, key)`
 * bindings below are the round-trip contract with saved cards: do not rename.
 *
 * The registry is role-adaptive: labels/helpers shift for user personas, and
 * `roles`/`defaultActive` drive which fields show per role. Field ids stay
 * constant across roles so values survive toggling.
 */
import { Flame, HeartHandshake, Quote, ScrollText, Shield, Swords, Tags, User } from 'lucide-react'
import type { SelectOption } from '@/ui/primitives'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'
import type { CharacterRole } from '@/shared/types/character.types'

export const RACE_OPTIONS: SelectOption[] = [
    { value: 'Human', label: 'Human', description: 'Adaptable and ambitious; found at every table and every war.' },
    { value: 'Elf', label: 'Elf', description: 'Long-lived and graceful, with memories older than kingdoms.' },
    { value: 'Dwarf', label: 'Dwarf', description: 'Stone-steady artisans who forget nothing — especially debts.' },
    { value: 'Halfling', label: 'Halfling', description: 'Small folk with quiet luck and large appetites.' },
    { value: 'Orc', label: 'Orc', description: 'Proud clan-folk of strength and blunt honesty, often misjudged.' },
    { value: 'Goblin', label: 'Goblin', description: 'Quick-fingered schemers and tinkerers who survive everything.' },
    { value: 'Tiefling', label: 'Tiefling', description: "Mortals marked by an old infernal bargain they didn't sign." },
    { value: 'Dragonkin', label: 'Dragonkin', description: 'Scaled heirs of dragons, carrying ember and pride.' },
    { value: 'Fae', label: 'Fae', description: 'Capricious spirits of glamour, bargains, and exact words.' },
    { value: 'Vampire', label: 'Vampire', description: 'Elegant predators of long nights and longer regrets.' },
    { value: 'Shapeshifter', label: 'Shapeshifter', description: 'Two natures in one skin, never fully at rest.' },
    { value: 'Undead', label: 'Undead', description: 'Returned from death with unfinished business.' },
    { value: 'Android / Construct', label: 'Android / Construct', description: 'A built mind discovering what it wants.' },
    { value: 'Alien', label: 'Alien', description: 'A visitor of unearthly biology and stranger etiquette.' },
    { value: 'Spirit', label: 'Spirit', description: 'A presence without a body, bound to a place, object, or promise.' },
]

export const ARCHETYPE_OPTIONS: SelectOption[] = [
    { value: 'Companion', label: 'Companion', description: "Loyal presence at the player's side; shares the road and the risk." },
    { value: 'Mentor', label: 'Mentor', description: 'Teaches, warns, and withholds exactly one crucial thing.' },
    { value: 'Guardian', label: 'Guardian', description: 'Protects a person, place, or rule — even from the player.' },
    { value: 'Trickster', label: 'Trickster', description: 'Breaks rules and tension; chaos with a purpose.' },
    { value: 'Rival', label: 'Rival', description: 'Wants what the player wants, and sometimes gets there first.' },
    { value: 'Villain', label: 'Villain', description: "Drives the central harm — and believes they're right." },
    { value: 'Rogue', label: 'Rogue', description: 'Self-interested charm; useful, never quite trustworthy.' },
    { value: 'Sage', label: 'Sage', description: 'Knows the answers; charges dearly, in riddles or favors.' },
    { value: 'Innocent', label: 'Innocent', description: 'Sees the world freshly; raises the stakes by existing.' },
    { value: 'Leader', label: 'Leader', description: 'Commands others; their orders shape the scene.' },
    { value: 'Outcast', label: 'Outcast', description: 'Lives outside the walls; knows the ways nobody else does.' },
    { value: 'Wildcard', label: 'Wildcard', description: 'Unpredictable by design; loyal to a logic all their own.' },
]

export const SPEECH_STYLE_OPTIONS: SelectOption[] = [
    { value: 'Gruff & warm', label: 'Gruff & warm', description: 'Short sentences, rough edges, soft center.' },
    { value: 'Menacingly polite', label: 'Menacingly polite', description: 'Never raises their voice; lowers it.' },
    { value: 'Playful & teasing', label: 'Playful & teasing', description: 'Banter first; sincerity only when it counts.' },
    { value: 'Formal & archaic', label: 'Formal & archaic', description: 'Speaks like a treaty written by candlelight.' },
    { value: 'Scholarly', label: 'Scholarly', description: 'Precise, footnoted, delighted to be asked.' },
    { value: 'Poetic', label: 'Poetic', description: 'Speaks in images; weather is always a metaphor.' },
    { value: 'Terse', label: 'Terse', description: 'Wastes no words; silence does the talking.' },
    { value: 'Street-sharp', label: 'Street-sharp', description: 'Fast slang, faster instincts; says less than they know.' },
    { value: 'Warm & rambling', label: 'Warm & rambling', description: 'Stories inside stories; the point arrives eventually.' },
    { value: 'Cold & precise', label: 'Cold & precise', description: 'Every word measured, none of them kind.' },
    { value: 'Shy & halting', label: 'Shy & halting', description: 'Half-sentences and second tries; honesty in fragments.' },
    { value: 'Theatrical', label: 'Theatrical', description: 'Performs every line for an audience only they can see.' },
]

const PERSONALITY = 'Personality'
const VOICE = 'Voice'
const RELATIONSHIPS = 'Relationships'
const BOUNDARIES = 'Boundaries'

const GROUP_DESCRIPTIONS: Record<string, string> = {
    [PERSONALITY]: 'What drives this character in play.',
    [VOICE]: 'How they sound and what they avoid saying.',
    [RELATIONSHIPS]: "Who they're tied to and how.",
    [BOUNDARIES]: 'Player agency and content rules the AI must respect.',
}

const bind = (group: string, key: string) => ({ group, key, groupDescription: GROUP_DESCRIPTIONS[group] })

/** The guided enrichment fields, adapted to the current card role. */
export function getCharacterFields(role: CharacterRole): CardFieldDefinition[] {
    const persona = role === 'persona'
    return [
        {
            id: 'personality.archetype',
            label: 'Archetype',
            helper: 'A one-word story role that tells the AI how this character pushes scenes.',
            input: 'suggest',
            options: ARCHETYPE_OPTIONS,
            exampleHint: 'Mentor',
            defaultActive: ['character'],
            binding: bind(PERSONALITY, 'Archetype'),
        },
        {
            id: 'personality.motivation',
            label: persona ? "What you're after" : 'Motivation',
            helper: 'What they want right now — desire is what makes the AI act instead of just describe.',
            input: 'text',
            exampleHint: 'To buy back the family forge before winter, whatever it takes.',
            defaultActive: true,
            binding: bind(PERSONALITY, 'Motivation'),
        },
        {
            id: 'personality.fear',
            label: 'Fear',
            helper: 'What they avoid or flee — fear tells the AI when they hesitate, lie, or break.',
            input: 'text',
            exampleHint: "Open water. She'll ride three days around a lake and call it a shortcut.",
            defaultActive: ['character'],
            binding: bind(PERSONALITY, 'Fear'),
        },
        {
            id: 'personality.secret',
            label: 'Secret',
            helper: 'Something true they hide — the AI can hint at it under pressure without announcing it.',
            input: 'text',
            exampleHint: "The 'family' forge was won in a rigged card game she rigged herself.",
            defaultActive: ['character'],
            binding: bind(PERSONALITY, 'Secret'),
        },
        {
            id: 'personality.quirks',
            label: 'Quirks',
            helper: 'Two or three repeatable habits that make them instantly recognizable in a scene.',
            input: 'text',
            exampleHint: 'Hums while working; refuses to count aloud in front of strangers; feeds every stray.',
            binding: bind(PERSONALITY, 'Quirks'),
        },
        {
            id: 'personality.values',
            label: 'Values',
            helper: "The line they won't cross — a compass for the AI when you do something unexpected.",
            input: 'text',
            exampleHint: 'A deal sealed by handshake is sacred; everything else is negotiable.',
            binding: bind(PERSONALITY, 'Values'),
        },
        {
            id: 'personality.pressure',
            label: persona ? 'Under pressure' : 'Pressure',
            helper: persona
                ? 'How you tend to react when things go wrong — guides pacing without stealing your choices.'
                : 'Why they must act now — pressure keeps them driving scenes instead of waiting.',
            input: 'text',
            exampleHint: persona
                ? 'Jokes first, plans second, never shows the fear until after.'
                : "The debt collector arrives at the new moon, and he doesn't renegotiate.",
            defaultActive: ['persona'],
            binding: bind(PERSONALITY, 'Pressure'),
        },
        {
            id: 'voice.speech',
            label: 'Speech style',
            helper: 'How they sound — the AI mirrors this in every line of dialogue.',
            input: 'suggest',
            options: SPEECH_STYLE_OPTIONS,
            exampleHint: 'Gruff & warm',
            defaultActive: ['character'],
            binding: bind(VOICE, 'Speech Style'),
        },
        {
            id: 'voice.catchphrase',
            label: 'Catchphrase',
            helper: 'A signature phrase the AI can drop at the right moment — sparingly, so it stays theirs.',
            input: 'text',
            exampleHint: '"Mend it or bury it."',
            roles: ['character'],
            binding: bind(VOICE, 'Catchphrase'),
        },
        {
            id: 'voice.example',
            label: 'Example dialogue',
            helper: 'A short sample exchange — the single strongest way to teach the AI their rhythm.',
            input: 'textarea',
            rows: 3,
            exampleHint:
                'Player: Can you fix it? / Lyra: *turns the blade over once* I can fix the steel. The man who broke it — that\'s your craft.',
            roles: ['character'],
            binding: bind(VOICE, 'Example Dialogue'),
        },
        {
            id: 'voice.wont',
            label: "Won't discuss",
            helper: 'Topics they deflect or refuse — silence is characterization the AI can play.',
            input: 'text',
            exampleHint: 'Her years in the capital; anyone who asks gets a new subject and stronger tea.',
            roles: ['character'],
            binding: bind(VOICE, "Won't Discuss"),
        },
        {
            id: 'ties.allies',
            label: 'Allies',
            helper: 'Who they trust — the AI colors reactions when these names come up.',
            input: 'text',
            exampleHint: 'Bren the dockmaster, who never asks why; her apprentice, who asks constantly.',
            defaultActive: ['character'],
            binding: bind(RELATIONSHIPS, 'Allies'),
        },
        {
            id: 'ties.rivals',
            label: 'Rivals',
            helper: 'Who works against them — rivalry gives the AI a ready source of friction.',
            input: 'text',
            exampleHint: "Master Corvane of the smiths' guild, who remembers the card game.",
            binding: bind(RELATIONSHIPS, 'Rivals'),
        },
        {
            id: 'ties.bonds',
            label: persona ? 'Ties to the cast' : 'Debts & bonds',
            helper: 'What they owe and to whom — debts are hooks the story can pull.',
            input: 'text',
            exampleHint: 'Owes the smuggler queen a favor; would cross a war zone for her sister.',
            defaultActive: ['persona'],
            binding: bind(RELATIONSHIPS, 'Bonds'),
        },
        {
            id: 'boundaries.agency',
            label: 'Player agency',
            helper: 'What the AI may never decide for you — actions, words, feelings — so you stay the author of your character.',
            input: 'textarea',
            rows: 3,
            exampleHint:
                'Never write my dialogue, decisions, or emotions. Describe the world up to my skin and stop. Small reflexes (flinching, catching breath) are fine.',
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Player Agency'),
        },
        {
            id: 'boundaries.address',
            label: 'Address & pronouns',
            helper: 'How the AI and other characters should refer to you in narration and dialogue.',
            input: 'text',
            exampleHint: "She/her. Characters call me 'Captain' in public, 'Mara' among friends.",
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Address & Pronouns'),
        },
        {
            id: 'boundaries.lines',
            label: 'Lines & veils',
            helper: 'Content to keep out entirely (lines) or off-screen (veils) — respected without being asked twice.',
            input: 'text',
            exampleHint: 'No harm to children, ever. Torture stays off-screen. Romance welcome; fade to black past kissing.',
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Lines & Veils'),
        },
        {
            id: 'boundaries.skills',
            label: 'Skills & limits',
            helper: "What your persona can and can't plausibly do, so the AI neither nerfs nor inflates you.",
            input: 'text',
            exampleHint: 'Excellent: sailing, knots, reading weather. Hopeless: horses, etiquette, holding her tongue.',
            roles: ['persona'],
            defaultActive: ['persona'],
            binding: bind(BOUNDARIES, 'Skills & Limits'),
        },
        {
            id: 'boundaries.knownsecrets',
            label: 'Known secrets',
            helper: "Things your persona knows that others don't — the AI won't leak them through NPCs.",
            input: 'text',
            exampleHint: "She knows the harbormaster's ledger is forged — and hasn't decided what to do about it.",
            roles: ['persona'],
            binding: bind(BOUNDARIES, 'Known Secrets'),
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
export function getCharacterSections(role: CharacterRole): CharacterSections {
    const persona = role === 'persona'
    return {
        identity: {
            id: 'identity',
            icon: User,
            title: 'Identity',
            description: 'Who they are at a glance — role, name, and kind.',
            fieldIds: [],
        },
        portrayal: {
            id: 'portrayal',
            icon: ScrollText,
            title: persona ? 'Who You Are' : 'Portrayal',
            description: persona
                ? 'The prose the AI reads every turn — who it is addressing, and how.'
                : "The prose the AI reads every turn — looks, manner, and first words.",
            fieldIds: [],
        },
        drives: {
            id: 'drives',
            icon: Flame,
            title: persona ? 'What Drives You' : 'Heart & Drives',
            description: persona
                ? 'What you chase and how you react — pacing cues, never decisions made for you.'
                : 'What they want, fear, and hide — desire is what makes the AI act.',
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
            title: 'Your Table Rules',
            description: 'What the AI may never decide for you — agency, address, and content lines.',
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
            title: 'Voice & Direction',
            description: 'How they sound, and the rules they perform under.',
            fieldIds: ['voice.speech', 'voice.catchphrase', 'voice.example', 'voice.wont'],
        },
        ties: {
            id: 'ties',
            icon: HeartHandshake,
            title: 'Ties',
            description: 'The people who can be invoked against them — or for them.',
            fieldIds: ['ties.allies', 'ties.rivals', 'ties.bonds'],
        },
        traits: {
            id: 'traits',
            icon: Swords,
            title: 'Traits & Stats',
            description: 'Optional numbers and free-form trait groups — group them however you like.',
            fieldIds: [],
        },
        triggers: {
            id: 'triggers',
            icon: Tags,
            title: 'Activation',
            description: 'The words that summon this card into a scene.',
            fieldIds: [],
        },
    }
}
