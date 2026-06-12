/**
 * Adventure guided-field registry — built as the opening contract: the exact
 * first image, the stakes and clock, who pushes back, and how the AI game
 * master should run it. The `(group, key)` bindings are the round-trip
 * contract with saved cards: do not rename.
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
import type { SelectOption } from '@/ui/primitives'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'

export const STAKES_OPTIONS: SelectOption[] = [
    { value: 'A life in the balance', label: 'A life in the balance', description: 'Someone specific dies if the players fail.' },
    { value: "A community's survival", label: "A community's survival", description: 'A village, crew, or district on the line.' },
    { value: 'A dangerous secret', label: 'A dangerous secret', description: 'A truth that reshapes loyalties if it surfaces.' },
    { value: 'Power changing hands', label: 'Power changing hands', description: 'A throne, vote, charter, or territory in play.' },
    { value: 'A soul or a bond', label: 'A soul or a bond', description: 'Love, friendship, or a literal soul at risk.' },
    { value: 'Personal honor', label: 'Personal honor', description: 'Reputation and standing — losses follow you.' },
    { value: "Someone's freedom", label: "Someone's freedom", description: "Liberty at stake, maybe the players' own." },
    { value: 'The world itself', label: 'The world itself', description: 'Existential — use sparingly so it stays heavy.' },
]

export const CLOCK_OPTIONS: SelectOption[] = [
    { value: 'Dawn deadline', label: 'Dawn deadline', description: 'Whatever must happen, must happen before sunrise.' },
    { value: 'Three days', label: 'Three days', description: 'Long enough to plan, short enough to hurt.' },
    { value: 'The festival ends', label: 'The festival ends', description: 'The cover and chaos disappear when it does.' },
    { value: 'Pursuers closing', label: 'Pursuers closing', description: "They're an hour behind, and gaining." },
    { value: 'Supplies running out', label: 'Supplies running out', description: 'Food, water, air, or ammunition is finite.' },
    { value: 'The ritual advances', label: 'The ritual advances', description: 'Each night it completes another stage.' },
    { value: 'A verdict approaches', label: 'A verdict approaches', description: 'A judgment is signed in seven days — unless.' },
]

export const TONE_OPTIONS: SelectOption[] = [
    { value: 'Heroic', label: 'Heroic', description: 'Brave deeds rewarded; hope wins, at a price.' },
    { value: 'Grim', label: 'Grim', description: 'Victories cost; trust is scarce.' },
    { value: 'Eerie', label: 'Eerie', description: 'Dread over gore; wrongness in small details.' },
    { value: 'Cozy', label: 'Cozy', description: 'Gentle stakes, warm resolutions.' },
    { value: 'Mischievous', label: 'Mischievous', description: 'Comedy welcome; consequences bounce.' },
    { value: 'Romantic', label: 'Romantic', description: 'Hearts are the real stakes.' },
    { value: 'Epic', label: 'Epic', description: 'Large canvas, mythic weight.' },
    { value: 'Noir', label: 'Noir', description: 'Everyone wants something; rain on everything.' },
    { value: 'Whimsical', label: 'Whimsical', description: 'Dream-logic and delight.' },
]

export const PACING_OPTIONS: SelectOption[] = [
    { value: 'Slow burn', label: 'Slow burn', description: 'Linger in scenes; let tension accumulate.' },
    { value: 'Steady', label: 'Steady', description: 'Scene, consequence, scene — classic rhythm.' },
    { value: 'Breakneck', label: 'Breakneck', description: 'Cut fast; something happens every turn.' },
]

export const NARRATION_OPTIONS: SelectOption[] = [
    { value: 'Cinematic', label: 'Cinematic', description: 'Visual, punchy, the camera always moving.' },
    { value: 'Literary', label: 'Literary', description: 'Rich prose, interiority, metaphor.' },
    { value: 'Sparse', label: 'Sparse', description: 'Minimal description; dialogue does the work.' },
    { value: 'Conversational', label: 'Conversational', description: 'Casual narrator voice, light fourth wall.' },
]

const OPENING = 'Opening'
const STAKES = 'Stakes'
const OPPOSITION = 'Opposition'
const SCENES = 'Scenes'
const DIRECTION = 'Direction'

const GROUP_DESCRIPTIONS: Record<string, string> = {
    [OPENING]: 'How the adventure begins.',
    [STAKES]: "What's at risk, and on what clock.",
    [OPPOSITION]: 'Who pushes back.',
    [SCENES]: 'Beats and places the GM may use — suggestions, not a script.',
    [DIRECTION]: 'How the AI game master should run it.',
}

const bind = (group: string, key: string) => ({ group, key, groupDescription: GROUP_DESCRIPTIONS[group] })

export const ADVENTURE_FIELDS: CardFieldDefinition[] = [
    {
        id: 'opening.scene',
        label: 'Opening scene',
        helper: 'The exact first image — the AI opens turn one here instead of improvising somewhere vague.',
        input: 'textarea',
        rows: 3,
        exampleHint:
            'Rain on the harbor steps at midnight. The letter in your hand is coming apart, but the wax seal — a crowned serpent — is intact.',
        defaultActive: true,
        binding: bind(OPENING, 'Opening Scene'),
    },
    {
        id: 'opening.incident',
        label: 'Inciting incident',
        helper: 'The event that just broke normal life — it gives turn one momentum.',
        input: 'text',
        exampleHint: 'The courier is dead before he reaches the corner, and no one else is on the street.',
        defaultActive: true,
        binding: bind(OPENING, 'Inciting Incident'),
    },
    {
        id: 'opening.choice',
        label: 'First choice',
        helper: 'A decision to put in front of the player immediately — adventures start when players choose.',
        input: 'text',
        exampleHint: 'Read the letter here under the lamp, or vanish first and read it safe — the watch is coming either way.',
        binding: bind(OPENING, 'First Choice'),
    },
    {
        id: 'stakes.what',
        label: "What's at stake",
        helper: "What's won or lost — stakes tell the AI how much pressure each scene should carry.",
        input: 'suggest',
        options: STAKES_OPTIONS,
        exampleHint: "If the letter's names go public, every safehouse in the city burns by week's end.",
        defaultActive: true,
        binding: bind(STAKES, "What's at Stake"),
    },
    {
        id: 'stakes.clock',
        label: 'Ticking clock',
        helper: 'A visible countdown — clocks stop stories from stalling and make resting cost something.',
        input: 'suggest',
        options: CLOCK_OPTIONS,
        exampleHint: 'The names on the list are being hunted one by one — two are already gone.',
        defaultActive: true,
        binding: bind(STAKES, 'Ticking Clock'),
    },
    {
        id: 'stakes.fail',
        label: 'If they fail',
        helper: 'Spell out the failure consequence — then the AI can let players truly fail without breaking the story.',
        input: 'text',
        exampleHint:
            'The serpent court takes the harbor quarter, and survivors learn your name was on the list of those who could have stopped it.',
        defaultActive: true,
        binding: bind(STAKES, 'If They Fail'),
    },
    {
        id: 'opposition.antagonist',
        label: 'Antagonist',
        helper: 'Who or what pushes back — opposition gives the AI a hand to play against you.',
        input: 'text',
        exampleHint: 'Mother Coil, spymistress of the serpent court, who never threatens twice.',
        defaultActive: true,
        binding: bind(OPPOSITION, 'Antagonist'),
    },
    {
        id: 'opposition.goal',
        label: 'Their goal',
        helper: 'What the opposition wants — villains with goals keep acting even while players hide.',
        input: 'text',
        exampleHint: 'To burn the list and everyone who has read it — which now includes you.',
        defaultActive: true,
        binding: bind(OPPOSITION, 'Their Goal'),
    },
    {
        id: 'opposition.move',
        label: 'Their next move',
        helper: 'What they do next if no one stops them — lets the AI escalate fairly, on schedule.',
        input: 'text',
        exampleHint: 'Tonight: the docks safehouse. Tomorrow: the chapel. She saves you for last.',
        binding: bind(OPPOSITION, 'Their Next Move'),
    },
    {
        id: 'scenes.beats',
        label: 'Possible beats',
        helper: 'Scene ideas the AI may use, reorder, or drop — suggestions, never a script.',
        input: 'textarea',
        rows: 3,
        exampleHint:
            "The courier's empty boots; a parley under the lighthouse; the archivist who knows the seal; the list's final name.",
        binding: bind(SCENES, 'Possible Beats'),
    },
    {
        id: 'scenes.places',
        label: 'Likely places',
        helper: 'Locations this story will probably visit — helps the AI stage scenes consistently.',
        input: 'text',
        exampleHint: 'The fog docks; the Counting House; the chapel of unclaimed bodies.',
        binding: bind(SCENES, 'Likely Places'),
    },
    {
        id: 'direction.tone',
        label: 'Tone',
        helper: 'The emotional register the AI game master should hold.',
        input: 'suggest',
        options: TONE_OPTIONS,
        exampleHint: 'Noir',
        defaultActive: true,
        binding: bind(DIRECTION, 'Tone'),
    },
    {
        id: 'direction.pacing',
        label: 'Pacing',
        helper: 'How fast scenes should cut.',
        input: 'select',
        options: PACING_OPTIONS,
        binding: bind(DIRECTION, 'Pacing'),
    },
    {
        id: 'direction.narration',
        label: 'Narration style',
        helper: 'The prose the GM narrates in.',
        input: 'suggest',
        options: NARRATION_OPTIONS,
        exampleHint: 'Cinematic',
        binding: bind(DIRECTION, 'Narration Style'),
    },
    {
        id: 'direction.agency',
        label: 'Player agency',
        helper: 'The contract that keeps it your story — what the GM must always leave to the player.',
        input: 'textarea',
        rows: 3,
        exampleHint:
            "Never decide my persona's actions, words, or feelings. End turns on an open situation or a question. Let my failures stand.",
        binding: bind(DIRECTION, 'Player Agency'),
    },
]

export const ADVENTURE_SECTIONS: GuidedSectionDefinition[] = [
    {
        id: 'scenario',
        icon: ScrollText,
        title: 'The Scenario',
        description: 'The standing brief the AI game master reads every turn.',
        fieldIds: [],
    },
    {
        id: 'opening',
        icon: Sunrise,
        title: 'The Opening',
        description: 'The exact first image, and what just went wrong.',
        fieldIds: ['opening.scene', 'opening.incident', 'opening.choice'],
    },
    {
        id: 'stakes',
        icon: Hourglass,
        title: 'Stakes & Clock',
        description: "What's at risk, and the countdown that keeps it moving.",
        fieldIds: ['stakes.what', 'stakes.clock', 'stakes.fail'],
    },
    {
        id: 'opposition',
        icon: Swords,
        title: 'Opposition',
        description: 'Who pushes back — and what they do if no one stops them.',
        fieldIds: ['opposition.antagonist', 'opposition.goal', 'opposition.move'],
    },
    {
        id: 'cast',
        icon: Users,
        title: 'The Cast',
        description: 'Choose the characters who share this story.',
        fieldIds: [],
    },
    {
        id: 'persona',
        icon: UserCircle,
        title: 'Your Persona',
        description: 'Play as one of your characters — optional.',
        fieldIds: [],
    },
    {
        id: 'world',
        icon: Globe,
        title: 'The World',
        description: 'Ground the adventure in one of your worlds — optional.',
        fieldIds: [],
    },
    {
        id: 'objectives',
        icon: Target,
        title: 'Objectives & Beats',
        description: 'Goals, suggested scenes, and free-form groups — optional.',
        fieldIds: ['scenes.beats', 'scenes.places'],
    },
    {
        id: 'direction',
        icon: Clapperboard,
        title: 'Direction',
        description: 'How the AI game master should run it — tone, pace, and your agency.',
        fieldIds: ['direction.tone', 'direction.pacing', 'direction.narration', 'direction.agency'],
    },
    {
        id: 'triggers',
        icon: Tags,
        title: 'Activation',
        description: "Keywords that pull this adventure's context into the scene.",
        fieldIds: [],
    },
]
