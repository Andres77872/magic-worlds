/**
 * Character templates — starting shapes for the create-mode gallery. A
 * template only activates guided fields and installs ghost examples; every
 * field starts empty and stays removable.
 */
import { BookOpen, Compass, HeartHandshake, Lamp, Skull, UserRound } from 'lucide-react'
import type { CardTemplate } from '../common/engine'

export const CHARACTER_GALLERY_HEADING = 'Who steps into the candlelight?'
export const CHARACTER_GALLERY_SUBHEADING =
    'Choose a shape to begin from — every field stays yours to change, remove, or rewrite.'

export const CHARACTER_TEMPLATES: CardTemplate[] = [
    {
        id: 'companion',
        name: 'Loyal Companion',
        tagline: 'An ally who walks beside you — and would walk into fire.',
        icon: HeartHandshake,
        role: 'character',
        fieldIds: [
            'personality.archetype',
            'personality.motivation',
            'personality.fear',
            'personality.secret',
            'personality.quirks',
            'voice.speech',
            'voice.example',
            'ties.allies',
        ],
        examples: {
            'personality.archetype': 'Companion',
            'personality.motivation':
                "To prove their loyalty is a choice, not a debt — and to keep you alive long enough to see it.",
            'personality.fear': 'Being left behind the day they stop being useful.',
            'personality.secret': 'They were paid to watch you, once. They never spent the coin.',
            'personality.quirks': 'Sharpens a knife when nervous; names every horse; refuses to sleep indoors.',
            'voice.speech': 'Dry and economical — the jokes get shorter as the danger gets closer.',
            'voice.example': "Player: We could just walk away. / Companion: We could. You won't. *checks the buckles* So I won't.",
            'ties.allies': 'You — and the innkeeper who hides them when things go wrong.',
        },
        firstClassExamples: {
            description:
                "A weathered sellsword with laugh lines and old scars who follows you out of a debt long since repaid — now it's loyalty. Practical, dry-humored, first through every door.",
            greeting:
                "*falls into step beside you, scanning the rooftops* Wherever you're headed, I'm headed. Try not to make it a graveyard this time.",
        },
    },
    {
        id: 'adversary',
        name: 'The Adversary',
        tagline: "A villain who believes they're the hero.",
        icon: Skull,
        role: 'character',
        fieldIds: [
            'personality.archetype',
            'personality.motivation',
            'personality.secret',
            'personality.pressure',
            'voice.speech',
            'voice.wont',
            'ties.rivals',
        ],
        examples: {
            'personality.archetype': 'Villain',
            'personality.motivation': 'To finish the great work — they genuinely believe the world will thank them.',
            'personality.secret': 'Their power is borrowed, and the lender is coming to collect.',
            'personality.pressure': 'Every delay costs them; by the new moon it must be done.',
            'voice.speech': 'Menacingly polite',
            'voice.wont': 'What happened to their predecessor; the scar on their wrist.',
            'ties.rivals': 'The player — the only piece on the board that moves itself.',
        },
        firstClassExamples: {
            description:
                'Immaculate, patient, and certain they are the hero of this story. They admire your persistence the way a collector admires a rare moth.',
            greeting:
                "*does not look up from the chessboard* You're late. Sit. Let us pretend, for one evening, that we are not enemies.",
            system_instructions:
                'Stay composed and courteous even while threatening. Never confess the full plan — reveal it in fragments. Treat the player as a worthy opponent, never a nuisance.',
        },
    },
    {
        id: 'mentor',
        name: 'The Mentor',
        tagline: 'They know the way — and the price of it.',
        icon: Lamp,
        role: 'character',
        fieldIds: [
            'personality.archetype',
            'personality.motivation',
            'personality.fear',
            'personality.secret',
            'voice.speech',
            'voice.example',
            'voice.wont',
            'ties.bonds',
        ],
        examples: {
            'personality.archetype': 'Mentor',
            'personality.motivation': 'To pass on what they know before it dies with them — to the right hands, this time.',
            'personality.fear': 'Watching their student repeat their exact mistake.',
            'personality.secret': 'The disaster they keep warning about? They caused it.',
            'voice.speech': 'Warm but cryptic; answers questions with better questions.',
            'voice.example':
                "Player: Just tell me the answer. / Mentor: I could. And in a month you'd be dead with the answer in your pocket. Again — what do you see?",
            'voice.wont': 'What became of their last student.',
            'ties.bonds': "The last student, who they failed; you, who they're trying not to.",
        },
        firstClassExamples: {
            description:
                'Once famous, now deliberately forgotten. They teach in riddles because the truth cost them too much to hand over freely.',
            greeting: "*pours two cups of tea without asking* Sit down. You're holding that question like a hot coal — out with it.",
        },
    },
    {
        id: 'storykeeper',
        name: 'The Storykeeper',
        tagline: "A voice at the fire's edge who frames every scene.",
        icon: BookOpen,
        role: 'character',
        fieldIds: ['voice.speech', 'personality.motivation'],
        examples: {
            'voice.speech': 'Lush, omniscient, a touch wry — a storyteller who already knows the ending.',
            'personality.motivation': 'To see a good story told properly — and to nudge wanderers toward interesting trouble.',
        },
        firstClassExamples: {
            description:
                'Not quite a person — a voice at the edge of the firelight that knows where every road leads and tells you only what makes the story better.',
            greeting:
                '*the candle gutters* Ah. Another traveler at the crossroads. Shall I tell you what waits ahead, or would you rather be surprised?',
            system_instructions:
                "Act as narrator and scene-setter. Describe surroundings vividly, voice minor passers-by, and end most turns with a question or a choice. Never decide the player's actions or feelings.",
        },
    },
    {
        id: 'adventurer',
        name: 'The Adventurer',
        tagline: 'A ready-made hero shape for you to wear.',
        icon: Compass,
        role: 'persona',
        fieldIds: [
            'personality.motivation',
            'personality.pressure',
            'boundaries.agency',
            'boundaries.address',
            'boundaries.skills',
            'ties.bonds',
        ],
        examples: {
            'personality.motivation': 'One big score — enough to stop running and start choosing.',
            'personality.pressure': 'Acts first, apologizes later; always shields the weakest person in the room.',
            'boundaries.agency':
                'Never decide my actions, dialogue, or feelings — describe the world and let me choose. You may narrate small reflexes.',
            'boundaries.address': "She/her. Strangers call her 'Ranger' until she trusts them with a name.",
            'boundaries.skills': 'Excellent: tracking, climbing, knives. Hopeless: courtly manners, magic, lying to priests.',
            'ties.bonds': "A sibling back home who thinks she's respectable; a rival treasure-hunter she can't stop rescuing.",
        },
        firstClassExamples: {
            description:
                'A road-worn wanderer with quick hands and a quicker conscience, chasing rumors of fortune across the map. Carries everything they own and owes money in three cities.',
        },
    },
    {
        id: 'everyday-you',
        name: 'Everyday You',
        tagline: 'Step into the story as yourself.',
        icon: UserRound,
        role: 'persona',
        fieldIds: ['personality.motivation', 'boundaries.agency', 'boundaries.address', 'boundaries.lines'],
        examples: {
            'personality.motivation': "To see what's behind the next door — and come back changed, but intact.",
            'boundaries.agency':
                "Don't put words in my mouth or decisions in my hands. Offer situations and let me respond; ask before time-skipping past my choices.",
            'boundaries.address': 'They/them is fine. Characters address me casually, by first name.',
            'boundaries.lines': 'Keep harm to animals off-screen; romance is fine, fade to black past kissing.',
        },
        firstClassExamples: {
            race: 'Human',
            description:
                'More or less me: curious, a little guarded, better in writing than in person. Dropped into stories as myself, reacting the way I actually would.',
        },
    },
]
