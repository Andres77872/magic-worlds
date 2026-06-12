/**
 * Adventure templates — starting shapes for the create-mode gallery. Every
 * adventure is a promise about the first hour of play; templates activate the
 * guided fields that make that promise and install ghost examples.
 */
import { Coffee, MoonStar, Search, Sword } from 'lucide-react'
import type { CardTemplate } from '../common/engine'

export const ADVENTURE_GALLERY_HEADING = 'How does it begin?'
export const ADVENTURE_GALLERY_SUBHEADING =
    'Every adventure is a promise about the first hour of play. Choose yours.'

export const ADVENTURE_TEMPLATES: CardTemplate[] = [
    {
        id: 'heroic-quest',
        name: 'Heroic Quest',
        tagline: 'A relic lost, a road dark, a deadline of moons.',
        icon: Sword,
        fieldIds: [
            'opening.scene',
            'opening.incident',
            'stakes.what',
            'stakes.clock',
            'stakes.fail',
            'opposition.antagonist',
            'opposition.goal',
            'scenes.beats',
            'direction.tone',
        ],
        examples: {
            'opening.scene':
                'Rain on the shrine steps at dusk. The dying protector presses the empty reliquary into your hands and says a name no one has spoken aloud in years.',
            'opening.incident': 'The relic was not stolen — it was traded away, by someone the protector trusted.',
            'stakes.what': 'Every warding stone on the border fails within a season; the villages go first.',
            'stakes.clock': 'Each full moon another beacon goes dark. Three remain.',
            'stakes.fail': "The dark takes the border villages, and the traitor's bargain becomes permanent law.",
            'opposition.antagonist': 'Lord-Warden Cael, who traded the relic to save his own besieged city — and will not undo it.',
            'opposition.goal': 'To hold his city at any cost and be remembered as its savior.',
            'scenes.beats': "The trail of the relic-cart; a bridge held by deserters; Cael's parley offer; the vault under the besieged city.",
            'direction.tone': 'Heroic',
        },
        firstClassExamples: {
            description:
                "The beacon-fires are lit for the first time in a century. The realm's last protector has fallen, and the relic that kept the dark at bay has been carried off the map. Someone must bring it back.",
        },
    },
    {
        id: 'investigation',
        name: 'The Investigation',
        tagline: 'A locked door, a dead man, one wrong star.',
        icon: Search,
        fieldIds: [
            'opening.scene',
            'opening.incident',
            'opening.choice',
            'stakes.what',
            'stakes.clock',
            'stakes.fail',
            'opposition.antagonist',
            'opposition.move',
            'scenes.beats',
            'direction.tone',
        ],
        examples: {
            'opening.scene':
                'You arrive as the constables leave. The widow meets you at the gate with the salvaged corner of the chart and one question: "Why did he lock the door from the inside?"',
            'opening.incident': "Last night the observatory's great lens was turned to face the city — not the sky.",
            'opening.choice': 'Examine the body before it\'s moved, or follow the academy clerk who keeps checking his watch.',
            'stakes.what': 'The widow hangs for it in a week if no better answer surfaces.',
            'stakes.clock': 'The magistrate signs the verdict in seven days; each day a witness goes quiet.',
            'stakes.fail': 'The widow hangs, the charts stay edited, and the false star keeps its secret.',
            'opposition.antagonist': 'Someone on the academy board who has been editing the star charts for years.',
            'opposition.move': 'Tonight they burn the duplicate charts in the archive.',
            'scenes.beats': 'The lens room by night; the pawned telescope key; the star that exists after all.',
            'direction.tone': 'Noir',
        },
        firstClassExamples: {
            description:
                "A locked observatory, a dead astronomer, and a sky chart burned in the grate — all but one corner, which shows a star that shouldn't exist. The academy wants it quiet. The widow wants it solved.",
        },
    },
    {
        id: 'long-night',
        name: 'The Long Night',
        tagline: 'Eleven travelers, one storm, something knocking.',
        icon: MoonStar,
        fieldIds: [
            'opening.scene',
            'stakes.what',
            'stakes.clock',
            'stakes.fail',
            'opposition.antagonist',
            'opposition.move',
            'scenes.places',
            'direction.tone',
            'direction.pacing',
            'direction.agency',
        ],
        examples: {
            'opening.scene':
                "The common room, firelight, wind screaming. The stationmaster bolts the door and announces there's food for three days. Then the first knock comes — from the cellar.",
            'stakes.what': 'Eleven lives, including yours — and whatever the thing outside actually wants.',
            'stakes.clock': 'The firewood runs out in three nights. The knocking gets closer each one.',
            'stakes.fail': "The waystation goes quiet, and next season's travelers find it spotless and empty.",
            'opposition.antagonist': "The visitor — patient, courteous, and wearing a missing traveler's voice.",
            'opposition.move': 'Tonight it will ask, in a voice you trust, to be let in.',
            'scenes.places': 'The cellar; the snowed-under stable; the bell tower above the drifts.',
            'direction.tone': 'Eerie',
            'direction.pacing': 'Slow burn',
            'direction.agency': 'Build dread from choices, not jump scares. Never harm my persona without a decision behind it.',
        },
        firstClassExamples: {
            description:
                'The mountain pass closed an hour after you reached the waystation. Eleven travelers, one storm, and something outside that knocks politely at the shutters and waits.',
        },
    },
    {
        id: 'quiet-days',
        name: 'Quiet Days',
        tagline: 'Small stakes that feel enormous.',
        icon: Coffee,
        fieldIds: [
            'opening.scene',
            'stakes.what',
            'stakes.clock',
            'scenes.beats',
            'direction.tone',
            'direction.pacing',
            'direction.agency',
        ],
        examples: {
            'opening.scene':
                'First morning: the key sticks, the cat refuses to leave, and your first customer is already waiting — the retired ferrywoman who "always has the corner table."',
            'stakes.what': "Small things that feel enormous: the shop's first season, the regulars' trust, the festival contract.",
            'stakes.clock': 'Three weeks to the lantern festival — the town votes on which shop caters it.',
            'scenes.beats': "The leak above table four; the rival baker's peace offering; the ferrywoman's unsent letter.",
            'direction.tone': 'Cozy',
            'direction.pacing': 'Slow burn',
            'direction.agency': 'Keep stakes personal and gentle — no sudden violence, no world-ending twists. Let quiet scenes breathe.',
        },
        firstClassExamples: {
            description:
                'The teahouse by the ferry dock has reopened under new management — yours. The regulars have opinions, the roof has a leak, and the festival is in three weeks. Nothing is wrong, exactly. Everything is interesting.',
        },
    },
]
