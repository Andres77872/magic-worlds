/** Device-only display choices. These never enter manuscript or AI context. */
export const readingOptions = {
    font: ['serif', 'sans'],
    size: ['small', 'standard', 'large'],
    spacing: ['compact', 'comfortable', 'roomy'],
    width: ['narrow', 'standard', 'wide'],
    contrast: ['standard', 'strong'],
} as const

export type ReadingPreferences = { readonly [K in keyof typeof readingOptions]: typeof readingOptions[K][number] }

export const DEFAULT_READING: ReadingPreferences = Object.freeze({
    font: 'serif', size: 'standard', spacing: 'comfortable', width: 'standard', contrast: 'standard',
})

export const readingPresets = {
    literary: DEFAULT_READING,
    close: { font: 'sans', size: 'large', spacing: 'roomy', width: 'narrow', contrast: 'strong' },
    spacious: { font: 'serif', size: 'large', spacing: 'roomy', width: 'wide', contrast: 'standard' },
} as const satisfies Record<string, ReadingPreferences>

export function isReadingPreferences(value: unknown): value is ReadingPreferences {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const record = value as Record<string, unknown>
    const fields = Object.keys(readingOptions) as (keyof ReadingPreferences)[]
    return Object.keys(record).length === fields.length && fields.every((field) =>
        typeof record[field] === 'string' && (readingOptions[field] as readonly string[]).includes(record[field] as string))
}

export function readingPreset(value: ReadingPreferences): keyof typeof readingPresets | 'custom' {
    return (Object.keys(readingPresets) as (keyof typeof readingPresets)[]).find((preset) =>
        (Object.keys(readingOptions) as (keyof ReadingPreferences)[]).every((field) => readingPresets[preset][field] === value[field])) ?? 'custom'
}

export function readingAttributes(value: ReadingPreferences) {
    return {
        'data-reading-font': value.font,
        'data-reading-size': value.size,
        'data-reading-spacing': value.spacing,
        'data-reading-width': value.width,
        'data-reading-contrast': value.contrast,
    }
}
