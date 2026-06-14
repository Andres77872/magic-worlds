/**
 * Item guided-field registry — built as a playable object: what can the player
 * do with it, and what changes when they do. The `(group, key)` bindings are
 * the round-trip contract with saved cards: do not rename.
 *
 * Option `value`s and `(group, key)` bindings are the saved-card data contract
 * and are never localized; option `description`s, field labels/helpers, and
 * section copy resolve through the threaded `t`.
 */
import { BookOpen, Gem, Layers, MapPin, ScrollText, Sparkles, Tags, Zap } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { SelectOption } from '@/ui/primitives'
import type { CardFieldDefinition, GuidedSectionDefinition } from '../common/engine'

const ITEM_TYPE_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Weapon', descriptionKey: 'creation.item.options.type.weapon' },
    { value: 'Armor / Worn', descriptionKey: 'creation.item.options.type.armor' },
    { value: 'Tool', descriptionKey: 'creation.item.options.type.tool' },
    { value: 'Key', descriptionKey: 'creation.item.options.type.key' },
    { value: 'Clue', descriptionKey: 'creation.item.options.type.clue' },
    { value: 'Relic', descriptionKey: 'creation.item.options.type.relic' },
    { value: 'Consumable', descriptionKey: 'creation.item.options.type.consumable' },
    { value: 'Book / Document', descriptionKey: 'creation.item.options.type.book' },
    { value: 'Device', descriptionKey: 'creation.item.options.type.device' },
    { value: 'Container', descriptionKey: 'creation.item.options.type.container' },
    { value: 'Vehicle', descriptionKey: 'creation.item.options.type.vehicle' },
    { value: 'Trinket', descriptionKey: 'creation.item.options.type.trinket' },
    { value: 'Instrument', descriptionKey: 'creation.item.options.type.instrument' },
    { value: 'Prop', descriptionKey: 'creation.item.options.type.prop' },
]

const ITEM_RARITY_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Common', descriptionKey: 'creation.item.options.rarity.common' },
    { value: 'Uncommon', descriptionKey: 'creation.item.options.rarity.uncommon' },
    { value: 'Rare', descriptionKey: 'creation.item.options.rarity.rare' },
    { value: 'Legendary', descriptionKey: 'creation.item.options.rarity.legendary' },
    { value: 'Unique', descriptionKey: 'creation.item.options.rarity.unique' },
    { value: 'Cursed', descriptionKey: 'creation.item.options.rarity.cursed' },
    { value: 'Sacred', descriptionKey: 'creation.item.options.rarity.sacred' },
    { value: 'Forbidden', descriptionKey: 'creation.item.options.rarity.forbidden' },
]

const ITEM_CONDITION_OPTION_DEFS: { value: string; descriptionKey: string }[] = [
    { value: 'Intact', descriptionKey: 'creation.item.options.condition.intact' },
    { value: 'Carried', descriptionKey: 'creation.item.options.condition.carried' },
    { value: 'Equipped', descriptionKey: 'creation.item.options.condition.equipped' },
    { value: 'Hidden', descriptionKey: 'creation.item.options.condition.hidden' },
    { value: 'Locked away', descriptionKey: 'creation.item.options.condition.lockedAway' },
    { value: 'Damaged', descriptionKey: 'creation.item.options.condition.damaged' },
    { value: 'Spent', descriptionKey: 'creation.item.options.condition.spent' },
    { value: 'Depleted', descriptionKey: 'creation.item.options.condition.depleted' },
    { value: 'Attuned', descriptionKey: 'creation.item.options.condition.attuned' },
    { value: 'Cursed', descriptionKey: 'creation.item.options.condition.cursed' },
    { value: 'Awakened', descriptionKey: 'creation.item.options.condition.awakened' },
    { value: 'Missing', descriptionKey: 'creation.item.options.condition.missing' },
]

const toOptions = (defs: { value: string; descriptionKey: string }[], t: TFunction): SelectOption[] =>
    defs.map((def) => ({ value: def.value, label: def.value, description: t(def.descriptionKey) }))

export function getItemTypeOptions(t: TFunction): SelectOption[] {
    return toOptions(ITEM_TYPE_OPTION_DEFS, t)
}

export function getItemRarityOptions(t: TFunction): SelectOption[] {
    return toOptions(ITEM_RARITY_OPTION_DEFS, t)
}

export function getItemConditionOptions(t: TFunction): SelectOption[] {
    return toOptions(ITEM_CONDITION_OPTION_DEFS, t)
}

const USE = 'Use'
const WHEREABOUTS = 'Whereabouts'
const STORY = 'Story'

const groupDescription = (group: string, t: TFunction): string => {
    switch (group) {
        case USE:
            return t('creation.item.groups.use')
        case WHEREABOUTS:
            return t('creation.item.groups.whereabouts')
        case STORY:
            return t('creation.item.groups.story')
        default:
            return ''
    }
}

const bind = (group: string, key: string, t: TFunction) => ({ group, key, groupDescription: groupDescription(group, t) })

export function getItemFields(t: TFunction): CardFieldDefinition[] {
    return [
        {
            id: 'use.how',
            label: t('creation.item.fields.how.label'),
            helper: t('creation.item.fields.how.helper'),
            input: 'text',
            exampleHint: 'Held flat in an open palm; the needle settles in three slow turns.',
            defaultActive: true,
            binding: bind(USE, "How It's Used", t),
        },
        {
            id: 'use.activation',
            label: t('creation.item.fields.activation.label'),
            helper: t('creation.item.fields.activation.helper'),
            input: 'text',
            exampleHint: 'Whisper the name of what you lost while the lid is open.',
            binding: bind(USE, 'Activation', t),
        },
        {
            id: 'use.cost',
            label: t('creation.item.fields.cost.label'),
            helper: t('creation.item.fields.cost.helper'),
            input: 'text',
            exampleHint: 'Each use, the bearer forgets one small true detail of the thing they seek.',
            defaultActive: true,
            binding: bind(USE, 'Cost', t),
        },
        {
            id: 'whereabouts.owner',
            label: t('creation.item.fields.owner.label'),
            helper: t('creation.item.fields.owner.helper'),
            input: 'text',
            exampleHint: "Mara, who hasn't opened it since the harbor.",
            defaultActive: true,
            binding: bind(WHEREABOUTS, 'Owner', t),
        },
        {
            id: 'whereabouts.location',
            label: t('creation.item.fields.location.label'),
            helper: t('creation.item.fields.location.helper'),
            input: 'text',
            exampleHint: "Locked in the lighthouse's tide-drawer.",
            binding: bind(WHEREABOUTS, 'Location', t),
        },
        {
            id: 'whereabouts.condition',
            label: t('creation.item.fields.condition.label'),
            helper: t('creation.item.fields.condition.helper'),
            input: 'suggest',
            options: getItemConditionOptions(t),
            exampleHint: 'Carried',
            binding: bind(WHEREABOUTS, 'Condition', t),
        },
        {
            id: 'story.truth',
            label: t('creation.item.fields.truth.label'),
            helper: t('creation.item.fields.truth.helper'),
            input: 'text',
            exampleHint: "The needle doesn't point to lost things. It points to the fog-daughter, who keeps them.",
            binding: bind(STORY, 'Hidden Truth', t),
        },
        {
            id: 'story.reveal',
            label: t('creation.item.fields.reveal.label'),
            helper: t('creation.item.fields.reveal.helper'),
            input: 'text',
            exampleHint: 'Follow the needle past the breakwater at low tide.',
            binding: bind(STORY, 'Reveal Condition', t),
        },
        {
            id: 'story.seekers',
            label: t('creation.item.fields.seekers.label'),
            helper: t('creation.item.fields.seekers.helper'),
            input: 'text',
            exampleHint: "The Salvors' Guild, who lost an entire ship and want one compass-reading.",
            binding: bind(STORY, 'Who Wants It', t),
        },
        {
            id: 'story.complication',
            label: t('creation.item.fields.complication.label'),
            helper: t('creation.item.fields.complication.helper'),
            input: 'text',
            exampleHint: 'Whatever it finds remembers being found.',
            binding: bind(STORY, 'Complication', t),
        },
    ]
}

export function getItemSections(t: TFunction): GuidedSectionDefinition[] {
    return [
        {
            id: 'identity',
            icon: Gem,
            title: t('creation.item.sections.identity.title'),
            description: t('creation.item.sections.identity.description'),
            fieldIds: [],
        },
        {
            id: 'overview',
            icon: ScrollText,
            title: t('creation.item.sections.overview.title'),
            description: t('creation.item.sections.overview.description'),
            fieldIds: [],
        },
        {
            id: 'effects',
            icon: Sparkles,
            title: t('creation.item.sections.effects.title'),
            description: t('creation.item.sections.effects.description'),
            fieldIds: [],
        },
        {
            id: 'limits',
            icon: Zap,
            title: t('creation.item.sections.limits.title'),
            description: t('creation.item.sections.limits.description'),
            fieldIds: ['use.how', 'use.activation', 'use.cost'],
        },
        {
            id: 'whereabouts',
            icon: MapPin,
            title: t('creation.item.sections.whereabouts.title'),
            description: t('creation.item.sections.whereabouts.description'),
            fieldIds: ['whereabouts.owner', 'whereabouts.location', 'whereabouts.condition'],
        },
        {
            id: 'story',
            icon: BookOpen,
            title: t('creation.item.sections.story.title'),
            description: t('creation.item.sections.story.description'),
            fieldIds: ['story.truth', 'story.reveal', 'story.seekers', 'story.complication'],
        },
        {
            id: 'traits',
            icon: Layers,
            title: t('creation.item.sections.traits.title'),
            description: t('creation.item.sections.traits.description'),
            fieldIds: [],
        },
        {
            id: 'triggers',
            icon: Tags,
            title: t('creation.item.sections.triggers.title'),
            description: t('creation.item.sections.triggers.description'),
            fieldIds: [],
        },
    ]
}
