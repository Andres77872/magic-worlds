/**
 * Item guided-field registry — built as a playable object: what can the player
 * do with it, and what changes when they do. The `(group, key)` bindings are
 * the round-trip contract with saved cards: do not rename.
 */
import { BookOpen, Gem, Layers, MapPin, ScrollText, Sparkles, Tags, Zap } from 'lucide-react'
import type { SelectOption } from '@/ui/primitives'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'

export const ITEM_TYPE_OPTIONS: SelectOption[] = [
    { value: 'Weapon', label: 'Weapon', description: 'Made to harm; invites trouble and questions.' },
    { value: 'Armor / Worn', label: 'Armor / Worn', description: 'Carried on the body; always present in scenes.' },
    { value: 'Tool', label: 'Tool', description: 'Practical use; shines in clever hands.' },
    { value: 'Key', label: 'Key', description: 'Opens something specific, somewhere.' },
    { value: 'Clue', label: 'Clue', description: 'Exists to reveal a truth when examined.' },
    { value: 'Relic', label: 'Relic', description: 'Unique and powerful; needs costs and limits.' },
    { value: 'Consumable', label: 'Consumable', description: "Spent on use; track what's left." },
    { value: 'Book / Document', label: 'Book / Document', description: 'Carries words that change things.' },
    { value: 'Device', label: 'Device', description: 'Mechanism or tech; can break, jam, or be hacked.' },
    { value: 'Container', label: 'Container', description: 'Holds other things; may be locked or trapped.' },
    { value: 'Vehicle', label: 'Vehicle', description: 'Moves people; has crew, fuel, and damage.' },
    { value: 'Trinket', label: 'Trinket', description: 'Small, precious, easy to hide or steal.' },
    { value: 'Instrument', label: 'Instrument', description: 'Played, not wielded; moves hearts or magic.' },
    { value: 'Prop', label: 'Prop', description: 'An ordinary thing that might matter later.' },
]

export const ITEM_RARITY_OPTIONS: SelectOption[] = [
    { value: 'Common', label: 'Common', description: 'Everyday; nobody looks twice.' },
    { value: 'Uncommon', label: 'Uncommon', description: 'Notable craft; worth stealing.' },
    { value: 'Rare', label: 'Rare', description: 'Few exist; experts know its name.' },
    { value: 'Legendary', label: 'Legendary', description: 'The songs disagree about it; everyone wants it.' },
    { value: 'Unique', label: 'Unique', description: 'The only one; the world reacts to it.' },
    { value: 'Cursed', label: 'Cursed', description: 'Comes with a hook in it.' },
    { value: 'Sacred', label: 'Sacred', description: 'Holy to someone — using it has witnesses.' },
    { value: 'Forbidden', label: 'Forbidden', description: 'Owning it is a crime, or a heresy.' },
]

export const ITEM_CONDITION_OPTIONS: SelectOption[] = [
    { value: 'Intact', label: 'Intact', description: 'Whole and working.' },
    { value: 'Carried', label: 'Carried', description: "On someone's person." },
    { value: 'Equipped', label: 'Equipped', description: 'Worn or wielded right now.' },
    { value: 'Hidden', label: 'Hidden', description: 'Exists, unfound.' },
    { value: 'Locked away', label: 'Locked away', description: 'Stored behind a lock or a guard.' },
    { value: 'Damaged', label: 'Damaged', description: 'Works poorly, or not at all.' },
    { value: 'Spent', label: 'Spent', description: 'One use; used.' },
    { value: 'Depleted', label: 'Depleted', description: 'Out of charges, doses, or fuel.' },
    { value: 'Attuned', label: 'Attuned', description: 'Bonded to its bearer.' },
    { value: 'Cursed', label: 'Cursed', description: 'An active ill effect rides it.' },
    { value: 'Awakened', label: 'Awakened', description: 'Something in it is now awake.' },
    { value: 'Missing', label: 'Missing', description: 'Gone from where it should be.' },
]

const USE = 'Use'
const WHEREABOUTS = 'Whereabouts'
const STORY = 'Story'

const GROUP_DESCRIPTIONS: Record<string, string> = {
    [USE]: 'How the item is used and what it costs.',
    [WHEREABOUTS]: "Where it is and what state it's in.",
    [STORY]: 'Secrets, seekers, and complications.',
}

const bind = (group: string, key: string) => ({ group, key, groupDescription: GROUP_DESCRIPTIONS[group] })

export const ITEM_FIELDS: CardFieldDefinition[] = [
    {
        id: 'use.how',
        label: "How it's used",
        helper: 'The physical verb — hold, ring, read aloud, pour — so the AI stages it concretely.',
        input: 'text',
        exampleHint: 'Held flat in an open palm; the needle settles in three slow turns.',
        defaultActive: true,
        binding: bind(USE, "How It's Used"),
    },
    {
        id: 'use.activation',
        label: 'Activation',
        helper: 'The condition that switches it on — a phrase, a place, a time, a state of mind.',
        input: 'text',
        exampleHint: 'Whisper the name of what you lost while the lid is open.',
        binding: bind(USE, 'Activation'),
    },
    {
        id: 'use.cost',
        label: 'Cost',
        helper: "What using it takes from someone — costs turn 'use item' into a real decision.",
        input: 'text',
        exampleHint: 'Each use, the bearer forgets one small true detail of the thing they seek.',
        defaultActive: true,
        binding: bind(USE, 'Cost'),
    },
    {
        id: 'whereabouts.owner',
        label: 'Owner',
        helper: 'Who holds it now — ownership decides whose scenes it appears in.',
        input: 'text',
        exampleHint: "Mara, who hasn't opened it since the harbor.",
        defaultActive: true,
        binding: bind(WHEREABOUTS, 'Owner'),
    },
    {
        id: 'whereabouts.location',
        label: 'Location',
        helper: 'Where it sits if nobody carries it — location turns an item into a destination.',
        input: 'text',
        exampleHint: "Locked in the lighthouse's tide-drawer.",
        binding: bind(WHEREABOUTS, 'Location'),
    },
    {
        id: 'whereabouts.condition',
        label: 'Condition',
        helper: 'Its current state — the AI respects this instead of inventing one.',
        input: 'suggest',
        options: ITEM_CONDITION_OPTIONS,
        exampleHint: 'Carried',
        binding: bind(WHEREABOUTS, 'Condition'),
    },
    {
        id: 'story.truth',
        label: 'Hidden truth',
        helper: "What's true about it that nobody knows — the AI holds it until the reveal condition.",
        input: 'text',
        exampleHint: "The needle doesn't point to lost things. It points to the fog-daughter, who keeps them.",
        binding: bind(STORY, 'Hidden Truth'),
    },
    {
        id: 'story.reveal',
        label: 'Reveal condition',
        helper: 'What unlocks the secret — without this, the AI must guess when to tell.',
        input: 'text',
        exampleHint: 'Follow the needle past the breakwater at low tide.',
        binding: bind(STORY, 'Reveal Condition'),
    },
    {
        id: 'story.seekers',
        label: 'Who wants it',
        helper: 'Who else is hunting it — pursuit makes an item generate scenes.',
        input: 'text',
        exampleHint: "The Salvors' Guild, who lost an entire ship and want one compass-reading.",
        binding: bind(STORY, 'Who Wants It'),
    },
    {
        id: 'story.complication',
        label: 'Complication',
        helper: 'The trouble it causes just by existing — the best items are problems you choose to keep.',
        input: 'text',
        exampleHint: 'Whatever it finds remembers being found.',
        binding: bind(STORY, 'Complication'),
    },
]

export const ITEM_SECTIONS: GuidedSectionDefinition[] = [
    {
        id: 'identity',
        icon: Gem,
        title: 'Identity',
        description: 'Name, kind, and how rare it is.',
        fieldIds: [],
    },
    {
        id: 'overview',
        icon: ScrollText,
        title: 'Overview',
        description: 'What it looks like — and the one sentence that says why it matters.',
        fieldIds: [],
    },
    {
        id: 'effects',
        icon: Sparkles,
        title: 'Powers',
        description: 'What it concretely does in play.',
        fieldIds: [],
    },
    {
        id: 'limits',
        icon: Zap,
        title: 'Use & Limits',
        description: "How it's used, what it costs, and where it fails.",
        fieldIds: ['use.how', 'use.activation', 'use.cost'],
    },
    {
        id: 'whereabouts',
        icon: MapPin,
        title: 'Whereabouts',
        description: "Who holds it, where it sits, and what state it's in.",
        fieldIds: ['whereabouts.owner', 'whereabouts.location', 'whereabouts.condition'],
    },
    {
        id: 'story',
        icon: BookOpen,
        title: 'Story',
        description: 'Origins, secrets, seekers, and the trouble it brings.',
        fieldIds: ['story.truth', 'story.reveal', 'story.seekers', 'story.complication'],
    },
    {
        id: 'traits',
        icon: Layers,
        title: 'Traits',
        description: 'Compact facts and free-form groups for fast scanning.',
        fieldIds: [],
    },
    {
        id: 'triggers',
        icon: Tags,
        title: 'Activation Words',
        description: 'Words that summon this object into a scene.',
        fieldIds: [],
    },
]
