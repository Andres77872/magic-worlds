/**
 * World templates — starting shapes for the create-mode gallery. Templates
 * activate guided fields and install ghost examples; values start empty.
 * `placeType`/genre ghosts are structural suggestions the creator applies.
 */
import { Castle, Ghost, Landmark, Rocket } from 'lucide-react'
import type { CardTemplate } from '../common/engine'

/** i18n keys for the gallery masthead — resolved at the WorldCreator. */
export const WORLD_GALLERY_HEADING_KEY = 'creation.world.galleryHeading'
export const WORLD_GALLERY_SUBHEADING_KEY = 'creation.world.gallerySubheading'

/** Place-type the template frames scenes at — applied on pick (still editable). */
export const WORLD_TEMPLATE_PLACE_TYPE: Record<string, string> = {
    'fantasy-realm': 'world',
    'city-of-intrigue': 'city',
    'haunted-place': 'landmark',
    'frontier-colony': 'settlement',
}

export const WORLD_TEMPLATES: CardTemplate[] = [
    {
        id: 'fantasy-realm',
        name: 'Fantasy Realm',
        nameKey: 'creation.world.templates.fantasyRealm.name',
        tagline: 'Old magic, older pacts, a kingdom holding its breath.',
        taglineKey: 'creation.world.templates.fantasyRealm.tagline',
        icon: Castle,
        fieldIds: [
            'sensory.sights',
            'sensory.sounds',
            'factions.ruling',
            'factions.rival',
            'conflict.active',
            'scenes.todo',
            'scenes.landmarks',
        ],
        examples: {
            'sensory.sights': 'Chalk cliffs, banner-hung bridges, hedge-shrines with melted candles.',
            'sensory.sounds': 'Bells across the valley at dusk; the river under everything.',
            'factions.ruling': 'The Brokenline Crown — a young queen ruling from a fortress her ancestors stole.',
            'factions.rival': 'The Old Groves — druids who remember who the land belonged to first.',
            'conflict.active': 'The standing stones are going dark one by one, and each side blames the other.',
            'scenes.todo': 'Petition the court, bargain with hedge-witches, escort caravans through the fey wood.',
            'scenes.landmarks': 'The Sunken Cathedral; the Last Standing Stone; the Bridge of Names.',
        },
        firstClassExamples: {
            type: 'High Fantasy',
            description:
                'A green and ancient kingdom stitched together by river-roads and old pacts, where magic pools in standing stones and every village keeps one secret from the crown.',
        },
    },
    {
        id: 'city-of-intrigue',
        name: 'City of Intrigue',
        nameKey: 'creation.world.templates.cityOfIntrigue.name',
        tagline: 'Marble above, knives below.',
        taglineKey: 'creation.world.templates.cityOfIntrigue.tagline',
        icon: Landmark,
        fieldIds: [
            'sensory.smells',
            'factions.ruling',
            'factions.rival',
            'factions.wildcard',
            'conflict.active',
            'secrets.truth',
            'secrets.reveal',
            'scenes.todo',
        ],
        examples: {
            'sensory.smells': "Salt, ink, oranges — and under it all, the canal's sweet rot.",
            'factions.ruling': 'House Vellore, who own the grain and therefore the peace.',
            'factions.rival': 'The Dockside Syndicate — they own everything House Vellore pretends not to need.',
            'factions.wildcard': 'The Masked Tribunal — judges no one elected and no one can find.',
            'conflict.active': 'An heir has vanished three days before the succession vote.',
            'secrets.truth': "The city's founding charter is a forgery, and exactly two people know it.",
            'secrets.reveal': 'If anyone opens the sealed archive beneath the senate.',
            'scenes.todo': "Trade favors at salons, tail a courier, buy a senator's secret.",
        },
        firstClassExamples: {
            type: 'Political Intrigue',
            description:
                'A marble city where nothing is forbidden and everything is noted. Power moves through dinner invitations, and the harbor fog hides more deals than the senate floor.',
        },
    },
    {
        id: 'haunted-place',
        name: 'The Haunted Place',
        nameKey: 'creation.world.templates.hauntedPlace.name',
        tagline: 'Somewhere that remembers being loved.',
        taglineKey: 'creation.world.templates.hauntedPlace.tagline',
        icon: Ghost,
        fieldIds: [
            'sensory.sights',
            'sensory.sounds',
            'sensory.smells',
            'sensory.weather',
            'secrets.truth',
            'secrets.who',
            'secrets.reveal',
            'scenes.dangers',
            'conflict.changing',
        ],
        examples: {
            'sensory.sights': 'Dust sheets shaped like seated figures; a dining table set for thirteen.',
            'sensory.sounds': 'A music box upstairs that winds itself; floorboards answering your steps a beat late.',
            'sensory.smells': 'Cold wax, wet stone, lilies long out of season.',
            'sensory.weather': 'Permanent overcast; candles burn blue in the east wing.',
            'secrets.truth': 'The haunting is a request, not a curse — someone here needs a promise kept.',
            'secrets.who': 'The groundskeeper, who has not aged and will not say why.',
            'secrets.reveal': "Spend a full night in the east wing, or find the thirteenth chair's nameplate.",
            'scenes.dangers': 'Mirrors after midnight; the cellar door that is sometimes a staircase.',
            'conflict.changing': 'Each night the rooms drift one door further from where they were.',
        },
        firstClassExamples: {
            type: 'Gothic Horror',
            description:
                'An abandoned manor that is not empty. The doors keep their own hours, the portraits have been rearranged, and something in the east wing remembers being loved.',
        },
    },
    {
        id: 'frontier-colony',
        name: 'Frontier Colony',
        nameKey: 'creation.world.templates.frontierColony.name',
        tagline: 'Thin air, thinner promises, a new world underneath.',
        taglineKey: 'creation.world.templates.frontierColony.tagline',
        icon: Rocket,
        fieldIds: [
            'sensory.sights',
            'sensory.sounds',
            'factions.ruling',
            'factions.rival',
            'conflict.scarcity',
            'conflict.active',
            'scenes.todo',
        ],
        examples: {
            'sensory.sights': 'Rust-orange dust on white domes; cargo gliders against two pale suns.',
            'sensory.sounds': "The air recyclers' constant hum — colonists wake instantly when it stops.",
            'factions.ruling': 'Meridian Charter Co., who hold the air contracts and the only ship offworld.',
            'factions.rival': 'The Freeholders — second-wave settlers who say the charter died with the founder.',
            'conflict.scarcity': "Water rations shrink every cycle; the new aquifer reads as 'biologically occupied'.",
            'conflict.active': 'Something is tunneling under Dome Three, and the company is drilling anyway.',
            'scenes.todo': 'Run salvage outside the wire, broker ration deals, sign on for the deep survey.',
        },
        firstClassExamples: {
            type: 'Sci-Fi',
            description:
                "A dome-and-scaffold settlement on a moon nobody owns yet, where air is bought by the liter and the founders' promises are wearing thin. Everyone came here to start over; the moon has other ideas.",
        },
    },
]
