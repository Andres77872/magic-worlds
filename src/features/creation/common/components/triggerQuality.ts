/** Trigger-quality checks shared by the creators' Activation sections. */

/** Words too common to be useful activation keys. */
const TRIGGER_STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'is', 'it',
    'he', 'she', 'they', 'you', 'i', 'we',
    'magic', 'city', 'sword', 'king', 'queen', 'man', 'woman', 'world', 'place',
    'character', 'item', 'story', 'adventure',
])

/** The first too-broad trigger, or null when all look specific enough. */
export function findBroadTrigger(triggers: string[]): string | null {
    for (const trigger of triggers) {
        const t = trigger.trim().toLowerCase()
        if (t.length > 0 && (t.length <= 3 || TRIGGER_STOPWORDS.has(t))) return trigger
    }
    return null
}
