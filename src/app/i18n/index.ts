import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGE_OPTIONS,
    readStoredLanguage,
    detectBrowserLanguage,
    normalizeLanguage,
    syncDocumentLanguage,
} from './languages'
import { resources } from './resources'
import { lazyLocaleBackend } from './backend'
import { installInAppCopyRelease } from '@/features/legal/documents/consentCopy'

const initialLanguage = readStoredLanguage() ?? detectBrowserLanguage() ?? DEFAULT_LANGUAGE

if (!i18next.isInitialized) {
    void i18next
        .use(lazyLocaleBackend)
        .use(initReactI18next)
        .init({
            // Only the default locale (en) is bundled; others load via the backend.
            resources,
            partialBundledLanguages: true,
            lng: initialLanguage,
            fallbackLng: DEFAULT_LANGUAGE,
            supportedLngs: SUPPORTED_LANGUAGE_OPTIONS.map((option) => option.code),
            interpolation: {
                escapeValue: false,
            },
            returnNull: false,
        })
    // R2-FE-01: the signed in-app voice lines replace their keys once released (no-op until then).
    installInAppCopyRelease(i18next)
}

syncDocumentLanguage(initialLanguage)

i18next.on('languageChanged', (language) => {
    syncDocumentLanguage(normalizeLanguage(language) ?? DEFAULT_LANGUAGE)
})

export { i18next as i18n }
export * from './languages'
