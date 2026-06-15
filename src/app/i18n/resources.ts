/**
 * Eager i18n bundle: only the default locale (en) ships in the main chunk.
 * Other locales are split into ./locales/<lng>.ts and lazy-loaded on demand by
 * the i18next backend in ./backend.ts. The en/es parity check lives in
 * ./locales/es.ts (it `satisfies` en's shape via a type-only import of EnShape).
 */
import { en } from './locales/en'

export const resources = {
    en: {
        translation: en,
    },
} as const
