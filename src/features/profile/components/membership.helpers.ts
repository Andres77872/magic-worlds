/**
 * Shared formatting helpers for the membership + usage profile sections.
 * Operation keys come from the backend's MEMBERSHIP_OPERATIONS constants.
 */

export const OPERATION_LABELS: Record<string, string> = {
    chat_interaction: 'Chat',
    ai_card_generation: 'AI cards',
    image_generation: 'Chat/adventure images',
    card_image_generation: 'Card images',
    theme_song_generation: 'Theme songs',
    tts_generation: 'TTS',
    voice_call: 'Call mode',
    lorebook_resource_extraction: 'Resource metadata',
}

/** Known operations first (in OPERATION_LABELS order), unknown ones after, alphabetically. */
export function orderedLimitEntries<T>(limits: Record<string, T>): Array<readonly [string, T]> {
    const known = Object.keys(OPERATION_LABELS).filter((operation) => operation in limits)
    const unknown = Object.keys(limits)
        .filter((operation) => !(operation in OPERATION_LABELS))
        .sort()
    return [...known, ...unknown].map((operation) => [operation, limits[operation]] as const)
}

export function operationLabel(operation: string) {
    return OPERATION_LABELS[operation] ?? humanize(operation)
}

export function formatNumber(value: number, locale?: string) {
    return new Intl.NumberFormat(locale).format(value)
}

function humanize(value: string) {
    return value
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}
