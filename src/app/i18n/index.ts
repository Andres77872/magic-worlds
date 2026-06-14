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

const initialLanguage = readStoredLanguage() ?? detectBrowserLanguage() ?? DEFAULT_LANGUAGE

if (!i18next.isInitialized) {
    void i18next
        .use(initReactI18next)
        .init({
            resources,
            lng: initialLanguage,
            fallbackLng: DEFAULT_LANGUAGE,
            supportedLngs: SUPPORTED_LANGUAGE_OPTIONS.map((option) => option.code),
            interpolation: {
                escapeValue: false,
            },
            returnNull: false,
        })
}

syncDocumentLanguage(initialLanguage)

i18next.on('languageChanged', (language) => {
    syncDocumentLanguage(normalizeLanguage(language) ?? DEFAULT_LANGUAGE)
})

export { i18next as i18n }
export * from './languages'
