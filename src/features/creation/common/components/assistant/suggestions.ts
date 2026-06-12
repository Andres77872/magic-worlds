import type { CardAssistantCardType } from '@/shared/types/aiCard.types'

export interface AssistantSuggestion {
    label: string
    prompt: string
}

/** Starter prompts shown in the empty state; clicking one sends it directly. */
export const ASSISTANT_SUGGESTIONS: Record<CardAssistantCardType, AssistantSuggestion[]> = {
    character: [
        {
            label: 'Create a new character',
            prompt: 'Create a brand-new character: pick an evocative name and race, and write a vivid two-paragraph description.',
        },
        {
            label: 'Write a greeting line',
            prompt: 'Write an in-character greeting line this character would open a one-on-one chat with.',
        },
        {
            label: 'Add personality quirks',
            prompt: 'Deepen the description with three memorable personality quirks and how they surface in roleplay.',
        },
    ],
    world: [
        {
            label: 'Invent a world from scratch',
            prompt: 'Invent a new world from scratch: name it, choose its type, and write a rich two-paragraph description.',
        },
        {
            label: 'Deepen the description',
            prompt: 'Expand the current description with sensory details, notable factions, and one simmering conflict.',
        },
        {
            label: 'Suggest scene triggers',
            prompt: 'Suggest trigger keywords that should pull this world into a scene, and update the card with them.',
        },
    ],
    adventure_template: [
        {
            label: 'Pitch an adventure hook',
            prompt: 'Pitch a compelling adventure hook for this template and fold it into the description.',
        },
        {
            label: 'Raise the stakes',
            prompt: 'Raise the stakes of this adventure: add a ticking clock and a hard moral choice to the description.',
        },
        {
            label: 'Draft opening scenes',
            prompt: 'Draft the opening scene beats for this adventure and weave them into the description.',
        },
    ],
    item: [
        {
            label: 'Create an item',
            prompt: 'Create a brand-new item: give it an evocative name, type, rarity, description, effects, limits, and useful trigger keywords.',
        },
        {
            label: 'Balance the effects',
            prompt: 'Review this item and make its effects, requirements, and limitations clear and playable.',
        },
        {
            label: 'Add origin lore',
            prompt: 'Deepen this item with origin lore, value, and compact metadata categories.',
        },
    ],
}

export const LOREBOOK_ASSISTANT_SUGGESTIONS: AssistantSuggestion[] = [
    {
        label: 'Create a new lorebook',
        prompt: 'Create a new lorebook for a fantasy campaign with 6 concise entries, practical activation keys, and a balanced token budget.',
    },
    {
        label: 'Add missing entries',
        prompt: 'Review this lorebook and add the most useful missing entries, keeping each entry concise and easy to activate.',
    },
    {
        label: 'Tighten activation keys',
        prompt: 'Improve the activation keys so entries trigger reliably without being too broad. Keep existing lore intact.',
    },
]
