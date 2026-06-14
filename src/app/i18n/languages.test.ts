import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    LANGUAGE_STORAGE_KEY,
    detectBrowserLanguage,
    normalizeLanguage,
    readStoredLanguage,
    resolveIntlLocale,
    syncDocumentLanguage,
    writeStoredLanguage,
} from './languages'

describe('language helpers', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.lang = ''
        document.documentElement.dir = ''
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('normalizes supported language tags to app language codes', () => {
        expect(normalizeLanguage('es-MX')).toBe('es')
        expect(normalizeLanguage('es_ES')).toBe('es')
        expect(normalizeLanguage('EN-us')).toBe('en')
        expect(normalizeLanguage('fr-FR')).toBeNull()
    })

    it('reads and writes only supported stored language values', () => {
        writeStoredLanguage('es')
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es')
        expect(readStoredLanguage()).toBe('es')

        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr')
        expect(readStoredLanguage()).toBeNull()
    })

    it('detects browser language from primary and fallback navigator languages', () => {
        vi.stubGlobal('navigator', { language: 'fr-FR', languages: ['fr-FR', 'es-MX'] })

        expect(detectBrowserLanguage()).toBe('es')
    })

    it('syncs document language metadata and resolves Intl locales', () => {
        syncDocumentLanguage('es')

        expect(document.documentElement.lang).toBe('es')
        expect(document.documentElement.dir).toBe('ltr')
        expect(resolveIntlLocale('es')).toBe('es-MX')
        expect(resolveIntlLocale('en')).toBe('en-US')
    })
})
