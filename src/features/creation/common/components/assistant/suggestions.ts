import type { CardAssistantCardType } from '@/shared/types/aiCard.types'

export interface AssistantSuggestion {
    /** i18n key for the chip label (UI copy); resolved with t() at the call site. */
    labelKey: string
    /** Sent verbatim to the LLM — never localize. */
    prompt: string
}

/** Starter prompts shown in the empty state; clicking one sends it directly. */
export const ASSISTANT_SUGGESTIONS: Record<CardAssistantCardType, AssistantSuggestion[]> = {
    character: [
        {
            labelKey: 'creation.common.suggestions.character.createNew',
            prompt: 'Create a brand-new character: pick an evocative name and race, and write a vivid two-paragraph description.',
        },
        {
            labelKey: 'creation.common.suggestions.character.writeGreeting',
            prompt: 'Write an in-character greeting line this character would open a one-on-one chat with.',
        },
        {
            labelKey: 'creation.common.suggestions.character.addQuirks',
            prompt: 'Deepen the description with three memorable personality quirks and how they surface in roleplay.',
        },
    ],
    world: [
        {
            labelKey: 'creation.common.suggestions.world.invent',
            prompt: 'Invent a new world from scratch: name it, choose its type, and write a rich two-paragraph description.',
        },
        {
            labelKey: 'creation.common.suggestions.world.deepen',
            prompt: 'Expand the current description with sensory details, notable factions, and one simmering conflict.',
        },
        {
            labelKey: 'creation.common.suggestions.world.suggestTriggers',
            prompt: 'Suggest trigger keywords that should pull this world into a scene, and update the card with them.',
        },
    ],
    adventure_template: [
        {
            labelKey: 'creation.common.suggestions.adventure_template.pitchHook',
            prompt: 'Pitch a compelling adventure hook for this template and fold it into the description.',
        },
        {
            labelKey: 'creation.common.suggestions.adventure_template.raiseStakes',
            prompt: 'Raise the stakes of this adventure: add a ticking clock and a hard moral choice to the description.',
        },
        {
            labelKey: 'creation.common.suggestions.adventure_template.draftScenes',
            prompt: 'Draft the opening scene beats for this adventure and weave them into the description.',
        },
    ],
    item: [
        {
            labelKey: 'creation.common.suggestions.item.create',
            prompt: 'Create a brand-new item: give it an evocative name, type, rarity, description, effects, limits, and useful trigger keywords.',
        },
        {
            labelKey: 'creation.common.suggestions.item.balance',
            prompt: 'Review this item and make its effects, requirements, and limitations clear and playable.',
        },
        {
            labelKey: 'creation.common.suggestions.item.addLore',
            prompt: 'Deepen this item with origin lore, value, and compact metadata categories.',
        },
    ],
}

export const LOREBOOK_ASSISTANT_SUGGESTIONS: AssistantSuggestion[] = [
    {
        labelKey: 'creation.common.suggestions.lorebook.createNew',
        prompt: 'Create a new lorebook for a fantasy campaign with 6 concise entries, practical activation keys, and a balanced token budget.',
    },
    {
        labelKey: 'creation.common.suggestions.lorebook.addEntries',
        prompt: 'Review this lorebook and add the most useful missing entries, keeping each entry concise and easy to activate.',
    },
    {
        labelKey: 'creation.common.suggestions.lorebook.tightenKeys',
        prompt: 'Improve the activation keys so entries trigger reliably without being too broad. Keep existing lore intact.',
    },
]
