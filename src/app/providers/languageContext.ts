import { createContext } from 'react'
import type { SupportedLanguage, SupportedLanguageOption } from '@/app/i18n'

export interface LanguageContextValue {
    language: SupportedLanguage
    option: SupportedLanguageOption
    intlLocale: string
    isSyncing: boolean
    syncError: string | null
    setLanguage: (language: SupportedLanguage) => Promise<void>
}

export const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)
