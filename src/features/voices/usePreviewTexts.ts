/**
 * The fixed recipe-preview texts for the chooser (D18). Loads them once per
 * language and session from `GET /voices/preview-texts` (account scope) and
 * shows the built-in copies until then. A 404 (a server without the route)
 * keeps the built-in set for the session; any other failure uses it for now
 * and retries on the next mount.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import { builtInPreviewTexts, parsePreviewTexts, previewLanguage, type PreviewTextSet } from './previewTexts'

const cache = new Map<string, Promise<PreviewTextSet>>()

function isNotFound(error: unknown): boolean {
    return (error as { status?: unknown } | null)?.status === 404
}

export function loadPreviewTexts(language: string): Promise<PreviewTextSet> {
    const cached = cache.get(language)
    if (cached) return cached
    const promise = Promise.resolve()
        .then(() => apiService.getPreviewTexts(language))
        .then((body): PreviewTextSet => {
            const texts = parsePreviewTexts(body)
            return texts ? { language, texts, source: 'server' } : builtInPreviewTexts(language)
        })
        .catch((error: unknown) => {
            if (!isNotFound(error)) cache.delete(language)
            return builtInPreviewTexts(language)
        })
    cache.set(language, promise)
    return promise
}

/** Forget loaded texts (tests; a sign-out does not need it: the texts are not per account). */
export function clearPreviewTextsCache(): void {
    cache.clear()
}

/** The app's current language as a preview language (`en` or `es`). */
export function usePreviewLanguage(): string {
    const { i18n } = useTranslation()
    return previewLanguage(i18n.resolvedLanguage ?? i18n.language)
}

/**
 * The texts for `language`: the built-in set right away, then the server's
 * once loaded. `enabled` false skips the request (a closed drawer).
 */
export function usePreviewTexts(language: string, enabled = true): PreviewTextSet {
    const [loaded, setLoaded] = useState<{ requested: string; set: PreviewTextSet } | null>(null)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        void loadPreviewTexts(language).then((set) => {
            if (!cancelled) setLoaded({ requested: language, set })
        })
        return () => {
            cancelled = true
        }
    }, [language, enabled])

    return loaded?.requested === language ? loaded.set : builtInPreviewTexts(language)
}

/**
 * The texts for several languages at once (Studio and picker rows, each
 * auditioned in its own voice's language): a lookup that answers the built-in
 * set until that language's texts load.
 */
export function usePreviewTextSets(languages: readonly string[], enabled = true): (language: string) => PreviewTextSet {
    const key = [...new Set(languages)].sort().join(',')
    const [loaded, setLoaded] = useState<Readonly<Record<string, PreviewTextSet>>>({})

    useEffect(() => {
        if (!enabled || !key) return
        let cancelled = false
        for (const language of key.split(',')) {
            void loadPreviewTexts(language).then((set) => {
                if (!cancelled) setLoaded((current) => (current[language] === set ? current : { ...current, [language]: set }))
            })
        }
        return () => {
            cancelled = true
        }
    }, [key, enabled])

    return useCallback((language: string) => loaded[language] ?? builtInPreviewTexts(language), [loaded])
}
