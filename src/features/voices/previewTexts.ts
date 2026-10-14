/**
 * Recipe-preview texts (D18, 05 §6.2, 03 §5.16 I-4). The server owns them
 * (`GET /voices/preview-texts?language=`, versioned by `PREVIEW_TEXTS_VERSION`)
 * and renders only by `text_id`: the client never sends free text. These
 * built-in copies keep the chooser and its transcript working on servers
 * without that route (a 404) or when it fails; the transcript then prefers the
 * `text` a preview response carries.
 *
 * Content, not UI copy: one line per kind and language, at most 150
 * characters, no brackets or markup (the sanitizer must leave them unchanged).
 */
import { normalizeLanguage } from '@/app/i18n/languages'
import type { PreviewTextId, PreviewTextItem } from '@/shared'

export const PREVIEW_TEXT_IDS: readonly PreviewTextId[] = ['narration', 'dialogue', 'thought']

export const PREVIEW_TEXT_MAX_CHARS = 150

export const DEFAULT_PREVIEW_LANGUAGE = 'en'

export type PreviewTexts = Readonly<Record<PreviewTextId, string>>

export const BUILT_IN_PREVIEW_TEXTS: Readonly<Record<string, PreviewTexts>> = {
    en: {
        narration: 'Rain whispered against the tower windows as the last candle burned low, and somewhere below, a door creaked open.',
        dialogue: 'Stay close and keep your voice down. If the guards hear us now, we will never reach the harbor before dawn.',
        thought: 'Why does this place feel so familiar? I have never been here, and yet I know exactly where that path leads.',
    },
    es: {
        narration: 'La lluvia susurraba contra las ventanas de la torre mientras la última vela se consumía, y abajo una puerta crujió.',
        dialogue: 'Quédate cerca y habla en voz baja. Si los guardias nos oyen ahora, nunca llegaremos al puerto antes del alba.',
        thought: '¿Por qué este lugar me resulta tan familiar? Nunca he estado aquí y, aun así, sé adónde lleva ese camino.',
    },
}

/** A set of the three texts for one language, and where it came from. */
export interface PreviewTextSet {
    /** The language the texts are in: what the preview request sends. */
    language: string
    texts: PreviewTexts
    source: 'server' | 'built_in'
}

/** The app language as a preview language (`en`, `es`), defaulting to English. */
export function previewLanguage(value?: string | null): string {
    return normalizeLanguage(value) ?? DEFAULT_PREVIEW_LANGUAGE
}

/** Built-in texts for `language`, or English for a language without its own copies. */
export function builtInPreviewTexts(language: string): PreviewTextSet {
    const own = BUILT_IN_PREVIEW_TEXTS[language]
    return own
        ? { language, texts: own, source: 'built_in' }
        : { language: DEFAULT_PREVIEW_LANGUAGE, texts: BUILT_IN_PREVIEW_TEXTS[DEFAULT_PREVIEW_LANGUAGE], source: 'built_in' }
}

const isTextId = (value: unknown): value is PreviewTextId => PREVIEW_TEXT_IDS.includes(value as PreviewTextId)

/**
 * The three texts from a `GET /voices/preview-texts` body, or null when the body
 * is malformed or misses a kind (the caller then uses the built-in set). Unknown
 * ids and extra fields are ignored.
 */
export function parsePreviewTexts(body: unknown): PreviewTexts | null {
    const items = (body as { items?: unknown } | null)?.items
    if (!Array.isArray(items)) return null
    const texts: Partial<Record<PreviewTextId, string>> = {}
    for (const item of items as Partial<PreviewTextItem>[]) {
        if (!item || !isTextId(item.text_id) || typeof item.text !== 'string') continue
        const text = item.text.trim()
        if (text && !texts[item.text_id]) texts[item.text_id] = text
    }
    return PREVIEW_TEXT_IDS.every((id) => texts[id]) ? (texts as PreviewTexts) : null
}
