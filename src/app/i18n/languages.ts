export type SupportedLanguage = 'en' | 'es'

export interface SupportedLanguageOption {
    code: SupportedLanguage
    label: string
    nativeLabel: string
    intlLocale: string
    dir: 'ltr' | 'rtl'
}

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'
export const LANGUAGE_STORAGE_KEY = 'magic_worlds:language'

export const SUPPORTED_LANGUAGE_OPTIONS: readonly SupportedLanguageOption[] = [
    {
        code: 'en',
        label: 'English',
        nativeLabel: 'English',
        intlLocale: 'en-US',
        dir: 'ltr',
    },
    {
        code: 'es',
        label: 'Spanish',
        nativeLabel: 'Español',
        intlLocale: 'es-MX',
        dir: 'ltr',
    },
]

const SUPPORTED_LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGE_OPTIONS.map((option) => option.code))

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
    return typeof value === 'string' && SUPPORTED_LANGUAGE_CODES.has(value)
}

export function normalizeLanguage(value?: string | null): SupportedLanguage | null {
    if (!value) return null
    const normalized = value.trim().toLowerCase().replace('_', '-')
    if (isSupportedLanguage(normalized)) return normalized
    const base = normalized.split('-')[0]
    return isSupportedLanguage(base) ? base : null
}

export function getLanguageOption(language: SupportedLanguage): SupportedLanguageOption {
    return SUPPORTED_LANGUAGE_OPTIONS.find((option) => option.code === language) ?? SUPPORTED_LANGUAGE_OPTIONS[0]
}

export function detectBrowserLanguage(): SupportedLanguage | null {
    if (typeof navigator === 'undefined') return null
    const candidates = [navigator.language, ...(navigator.languages ?? [])]
    for (const candidate of candidates) {
        const language = normalizeLanguage(candidate)
        if (language) return language
    }
    return null
}

export function readStoredLanguage(): SupportedLanguage | null {
    if (typeof localStorage === 'undefined') return null
    try {
        return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
    } catch {
        return null
    }
}

export function writeStoredLanguage(language: SupportedLanguage) {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
        // Local storage can be unavailable in private browsing or locked-down embeds.
    }
}

export function syncDocumentLanguage(language: SupportedLanguage) {
    if (typeof document === 'undefined') return
    const option = getLanguageOption(language)
    document.documentElement.lang = option.code
    document.documentElement.dir = option.dir
}

export function resolveCurrentLanguage(value?: string | null): SupportedLanguage {
    return normalizeLanguage(value) ?? readStoredLanguage() ?? detectBrowserLanguage() ?? DEFAULT_LANGUAGE
}

export function resolveIntlLocale(language?: SupportedLanguage | string | null): string {
    return getLanguageOption(resolveCurrentLanguage(language)).intlLocale
}
