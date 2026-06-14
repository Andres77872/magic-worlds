import { useCallback, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import {
    DEFAULT_LANGUAGE,
    getLanguageOption,
    i18n as appI18n,
    isSupportedLanguage,
    normalizeLanguage,
    syncDocumentLanguage,
    writeStoredLanguage,
    type SupportedLanguage,
} from '@/app/i18n'
import { LanguageContext } from '@/app/providers/languageContext'

export function useLanguage() {
    const context = useContext(LanguageContext)
    const { i18n } = useTranslation()

    const setLocalLanguage = useCallback(
        async (next: SupportedLanguage) => {
            if (!isSupportedLanguage(next)) return
            writeStoredLanguage(next)
            syncDocumentLanguage(next)
            await (i18n ?? appI18n).changeLanguage(next)
        },
        [i18n],
    )

    if (context) return context

    const language = normalizeLanguage((i18n ?? appI18n).language) ?? DEFAULT_LANGUAGE
    const option = getLanguageOption(language)
    return {
        language,
        option,
        intlLocale: option.intlLocale,
        isSyncing: false,
        syncError: null,
        setLanguage: setLocalLanguage,
    }
}
