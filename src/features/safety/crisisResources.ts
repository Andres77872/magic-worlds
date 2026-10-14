/**
 * Crisis resources shown with a voice safety pause (R2-BE-01 FE; 13 §2.7).
 *
 * Which lines to list, their names and numbers per country are legal content
 * (CN-7). Until counsel signs them the entries are {@link LEGAL_PENDING}
 * placeholders and the document stays `draft`, so
 * {@link shippableCrisisResources} returns nothing and the panel shows only
 * the approved generic lines (`voiceSafety.paused`, `voiceSafety.emergency`).
 * The legal ship gate keeps the marker out of anything `final`.
 */
import { LEGAL_PENDING, isShippable, type LegalDraft, type LegalLanguage } from '@/features/legal/documents'

export interface CrisisResource {
    /** Stable id, e.g. a country code plus a slug. */
    id: string
    /** ISO 3166-1 alpha-2 country the line serves, or null for an international line. */
    country: string | null
    name: string
    /** How to reach it (number or short instruction), as counsel words it. */
    contact: string
}

export const CRISIS_RESOURCES: LegalDraft<CrisisResource[]> = {
    id: 'crisis-resources',
    status: 'draft',
    en: [
        { id: 'us', country: 'US', name: LEGAL_PENDING, contact: LEGAL_PENDING },
        { id: 'mx', country: 'MX', name: LEGAL_PENDING, contact: LEGAL_PENDING },
        { id: 'es', country: 'ES', name: LEGAL_PENDING, contact: LEGAL_PENDING },
        { id: 'intl', country: null, name: LEGAL_PENDING, contact: LEGAL_PENDING },
    ],
    es: [
        { id: 'us', country: 'US', name: LEGAL_PENDING, contact: LEGAL_PENDING },
        { id: 'mx', country: 'MX', name: LEGAL_PENDING, contact: LEGAL_PENDING },
        { id: 'es', country: 'ES', name: LEGAL_PENDING, contact: LEGAL_PENDING },
        { id: 'intl', country: null, name: LEGAL_PENDING, contact: LEGAL_PENDING },
    ],
}

/**
 * The entries the panel may render: none while the document is a draft or
 * carries the marker, so a pending number can never reach a user.
 */
export function shippableCrisisResources(
    language: LegalLanguage,
    resources: LegalDraft<CrisisResource[]> = CRISIS_RESOURCES,
): CrisisResource[] {
    return isShippable(resources) ? resources[language] : []
}
