/**
 * Item templates — starting shapes for the create-mode gallery. Templates
 * activate guided fields and install ghost examples; values start empty.
 */
import { Backpack, Fingerprint, FlaskConical, KeyRound, Sparkles } from 'lucide-react'
import type { CardTemplate } from '../common/engine'

export const ITEM_GALLERY_HEADING = 'What do they find?'
export const ITEM_GALLERY_SUBHEADING =
    'An object becomes a story the moment someone can use it. Start with a shape.'

export const ITEM_TEMPLATES: CardTemplate[] = [
    {
        id: 'artifact',
        name: 'The Artifact',
        tagline: 'Power with a hook in it.',
        icon: Sparkles,
        fieldIds: [
            'use.how',
            'use.activation',
            'use.cost',
            'whereabouts.owner',
            'whereabouts.condition',
            'story.truth',
            'story.reveal',
            'story.seekers',
        ],
        examples: {
            'use.how': 'Rung once, deliberately — it cannot be rung by accident.',
            'use.activation': 'Ring it while naming a broken promise aloud.',
            'use.cost': 'The ringer must first confess one true guilt of their own, aloud.',
            'whereabouts.owner': 'Sealed in the cathedral vault — officially.',
            'whereabouts.condition': 'Locked away',
            'story.truth': 'The bell does not detect lies; it remembers them. It has heard yours.',
            'story.reveal': 'It rings on its own the first time its bearer breaks a promise.',
            'story.seekers': 'Three courts want it for three trials whose verdicts cannot all be true.',
        },
        firstClassExamples: {
            type: 'Relic',
            rarity: 'Cursed',
            description:
                'A blackened silver bell that makes no sound at all — except in the hands of a liar, who hears it perfectly.',
            effects: 'Forces oathbreakers present to hear the voice of the one they betrayed',
            requirements: 'Only answers a bearer who has kept at least one terrible promise',
            limitations: 'Powerless against those who cannot remember their promises',
            origin: 'Cast from the melted reliquary of Saint Orven, who never once lied, and died for it.',
        },
    },
    {
        id: 'key',
        name: 'The Key',
        tagline: 'It opens one thing, somewhere.',
        icon: KeyRound,
        fieldIds: ['use.how', 'use.activation', 'use.cost', 'whereabouts.location', 'whereabouts.condition', 'story.seekers'],
        examples: {
            'use.how': 'Turned in any lock bearing the crescent seal; it hums when one is near.',
            'use.activation': 'Turn it while moonlight touches the lock.',
            'use.cost': 'Works once per moonrise.',
            'whereabouts.location': "Sewn into the lining of a stolen courier's coat.",
            'whereabouts.condition': 'Hidden',
            'story.seekers': 'The gatewardens, who can feel every door it opens.',
        },
        firstClassExamples: {
            type: 'Key',
            description:
                'A narrow silver key with a crescent seal cut into the bow. It is always slightly cold, and it hums near the doors it was made for.',
            effects: 'Opens any lock marked with the crescent seal',
            limitations: 'Useless on unmarked locks',
        },
    },
    {
        id: 'clue',
        name: 'The Clue',
        tagline: 'It knows something; make them earn it.',
        icon: Fingerprint,
        fieldIds: ['whereabouts.location', 'whereabouts.condition', 'story.truth', 'story.reveal'],
        examples: {
            'whereabouts.location': 'Observatory ruins, beneath the broken stair.',
            'whereabouts.condition': 'Hidden',
            'story.truth': 'The lens is one of a matched pair; its twin is still mounted, pointed at the city.',
            'story.reveal': "Inspect it under blue flame, or compare it against the observatory's inventory.",
        },
        firstClassExamples: {
            type: 'Clue',
            description:
                'A cracked brass lens found by the collapsed observatory stair, still smelling faintly of ozone. Whoever dropped it left in a hurry — and went down, not up.',
            effects: 'Shows that the blast came from below, not from the sky',
            limitations: 'Proves how — not who',
        },
    },
    {
        id: 'equipment',
        name: 'Trusty Equipment',
        tagline: 'Worn, reliable, full of stories.',
        icon: Backpack,
        fieldIds: ['whereabouts.owner', 'whereabouts.condition'],
        examples: {
            'whereabouts.owner': 'You, for years now.',
            'whereabouts.condition': 'Equipped',
        },
        firstClassExamples: {
            type: 'Armor / Worn',
            rarity: 'Common',
            description:
                'A traveling cloak of oiled gray wool, patched in six places, each patch a story. It has kept its owner dry, hidden, and — once, wrapped fast around an arm — alive.',
            effects: 'Sheds rain and lamplight alike; in dim light its wearer is easy to overlook',
            limitations: "It's wool, not armor; fire treats it like any other cloak",
            value: 'Worthless at market; not for sale at any price.',
        },
    },
    {
        id: 'consumable',
        name: 'The Consumable',
        tagline: 'One use; make it count.',
        icon: FlaskConical,
        fieldIds: ['use.cost', 'whereabouts.condition'],
        examples: {
            'use.cost': 'The drinker sleeps the next night dreamless — healing is borrowed, and the body collects.',
            'whereabouts.condition': 'Intact',
        },
        firstClassExamples: {
            type: 'Consumable',
            description:
                "A stoppered vial of amber light that moves like slow honey. It is warm in the hand and smells, faintly, of a summer that hasn't happened yet.",
            effects: 'One swallow closes wounds and burns away poison',
            requirements: 'Must be drunk fresh; loses potency at the first frost',
            limitations: 'Cannot mend bone or memory',
        },
    },
]
