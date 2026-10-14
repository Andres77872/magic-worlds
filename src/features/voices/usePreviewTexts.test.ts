import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    BUILT_IN_PREVIEW_TEXTS,
    PREVIEW_TEXT_IDS,
    PREVIEW_TEXT_MAX_CHARS,
    builtInPreviewTexts,
    parsePreviewTexts,
    previewLanguage,
} from './previewTexts'
import { clearPreviewTextsCache, loadPreviewTexts, usePreviewTexts, usePreviewTextSets } from './usePreviewTexts'

const getPreviewTexts = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: { getPreviewTexts: (...a: unknown[]) => getPreviewTexts(...a) },
}))

const serverTexts = {
    items: [
        { text_id: 'narration', kind: 'narration', text: 'Server narration line.' },
        { text_id: 'dialogue', kind: 'dialogue', text: 'Server dialogue line.' },
        { text_id: 'thought', kind: 'thought', text: 'Server thought line.' },
    ],
}

describe('built-in preview texts', () => {
    it('has the three kinds per curated language, short and without markup', () => {
        for (const language of ['en', 'es']) {
            for (const id of PREVIEW_TEXT_IDS) {
                const text = BUILT_IN_PREVIEW_TEXTS[language][id]
                expect(text.length).toBeGreaterThan(20)
                expect(text.length).toBeLessThanOrEqual(PREVIEW_TEXT_MAX_CHARS)
                expect(text).not.toMatch(/[[\]<>(){}#]/)
            }
        }
    })

    it('falls back to English for a language without its own copies', () => {
        expect(builtInPreviewTexts('fr')).toMatchObject({ language: 'en', source: 'built_in' })
        expect(builtInPreviewTexts('es').texts).toBe(BUILT_IN_PREVIEW_TEXTS.es)
        expect(previewLanguage('es-MX')).toBe('es')
        expect(previewLanguage('de')).toBe('en')
        expect(previewLanguage(undefined)).toBe('en')
    })

    it('parses a server body and rejects incomplete ones', () => {
        expect(parsePreviewTexts(serverTexts)).toEqual({
            narration: 'Server narration line.',
            dialogue: 'Server dialogue line.',
            thought: 'Server thought line.',
        })
        expect(parsePreviewTexts({ items: serverTexts.items.slice(0, 2) })).toBeNull()
        expect(parsePreviewTexts({ items: [{ text_id: 'narration', text: '   ' }] })).toBeNull()
        expect(parsePreviewTexts(null)).toBeNull()
        expect(parsePreviewTexts({ detail: 'Not Found' })).toBeNull()
    })
})

describe('usePreviewTexts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        clearPreviewTextsCache()
    })

    it('shows the built-in texts at once, then the server texts', async () => {
        getPreviewTexts.mockResolvedValue(serverTexts)
        const { result } = renderHook(() => usePreviewTexts('en'))

        expect(result.current).toMatchObject({ language: 'en', source: 'built_in' })
        await waitFor(() => expect(result.current.source).toBe('server'))
        expect(result.current.texts.thought).toBe('Server thought line.')
        expect(getPreviewTexts).toHaveBeenCalledWith('en')
    })

    it('keeps the built-in texts for the session when the route 404s (older server)', async () => {
        getPreviewTexts.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }))

        await expect(loadPreviewTexts('es')).resolves.toMatchObject({ language: 'es', source: 'built_in' })
        await loadPreviewTexts('es')

        expect(getPreviewTexts).toHaveBeenCalledTimes(1)
    })

    it('uses the built-in texts on a transient failure and retries later', async () => {
        getPreviewTexts.mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 })).mockResolvedValueOnce(serverTexts)

        await expect(loadPreviewTexts('en')).resolves.toMatchObject({ source: 'built_in' })
        await expect(loadPreviewTexts('en')).resolves.toMatchObject({ source: 'server' })
        expect(getPreviewTexts).toHaveBeenCalledTimes(2)
    })

    it('does not request while disabled', () => {
        const { result } = renderHook(() => usePreviewTexts('en', false))
        expect(getPreviewTexts).not.toHaveBeenCalled()
        expect(result.current.texts).toBe(BUILT_IN_PREVIEW_TEXTS.en)
    })

    it('loads each distinct language once for a list of voices', async () => {
        getPreviewTexts.mockImplementation(async (language: string) => (language === 'es' ? serverTexts : { items: [] }))
        const { result } = renderHook(() => usePreviewTextSets(['en', 'es', 'en']))

        expect(result.current('es')).toMatchObject({ language: 'es', source: 'built_in' })
        await waitFor(() => expect(result.current('es').source).toBe('server'))
        expect(result.current('en')).toMatchObject({ language: 'en', source: 'built_in' })
        expect(getPreviewTexts).toHaveBeenCalledTimes(2)
    })

    it('a list lookup does not request while disabled', () => {
        const { result } = renderHook(() => usePreviewTextSets(['es'], false))
        expect(getPreviewTexts).not.toHaveBeenCalled()
        expect(result.current('es').texts).toBe(BUILT_IN_PREVIEW_TEXTS.es)
    })
})
