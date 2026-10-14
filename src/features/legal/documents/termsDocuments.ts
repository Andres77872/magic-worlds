/**
 * Terms of Service documents by version (R2-FE-01; 13 §3.3). Each key is a
 * version string the BFF can require (`ATTESTATION_TERMS_OF_SERVICE_VERSION`,
 * default `tos-v1`), so the Terms page and the attestation prompt always show
 * the exact text being accepted. A version the SPA does not ship has no
 * document: the prompt then refuses to record it (`attestation.termsUnavailable`).
 *
 * Deploy order: a new version ships here first (status `final`, with an
 * effective date); ops bumps the BFF version only after that release is live.
 *
 * `tos-v1` is the counsel outline already published on the Terms page: its
 * text is the `legal.pages.terms.sections.*` copy, read from the same locale
 * module so the page stays word for word what it was. It stays `draft` until
 * counsel signs the final terms (CN-2).
 */
import { termsPageEn, termsPageEs } from '@/app/i18n/locales/voiceAccess'
import type { LegalDraft } from './legalPending'

export interface TermsSection {
    /** Stable section id (icons and anchors key on it). */
    id: string
    title: string
    body: string[]
}

export interface TermsDocument {
    sections: TermsSection[]
    /** ISO date the version takes effect; null while the document is a draft. */
    effectiveDate: string | null
}

/** The BFF's attestation version pattern (`route_attestations.py`, `voice_models.py`). */
export const TERMS_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

const TOS_V1_SECTIONS = ['eligibility', 'acceptableUse', 'providers', 'enforcement', 'aiVoices', 'changes'] as const

type TermsPageCopy = typeof termsPageEn

function outlineV1(page: TermsPageCopy): TermsDocument {
    return {
        effectiveDate: null,
        sections: TOS_V1_SECTIONS.map((id) => ({ id, title: page.sections[id].title, body: [page.sections[id].body1] })),
    }
}

export const TERMS_DOCUMENTS: Readonly<Record<string, LegalDraft<TermsDocument>>> = Object.freeze({
    'tos-v1': { id: 'tos-v1', status: 'draft', en: outlineV1(termsPageEn), es: outlineV1(termsPageEs) },
})

/** The newest version in {@link TERMS_DOCUMENTS}: what a visitor without a server status reads. */
export const LATEST_TERMS_VERSION = 'tos-v1'

function hasVersion(registry: Readonly<Record<string, unknown>>, version: string): boolean {
    return Object.prototype.hasOwnProperty.call(registry, version)
}

/** The document for a server version string, or null when the SPA does not ship it. */
export function termsDocumentFor(
    version: string | null | undefined,
    registry: Readonly<Record<string, LegalDraft<TermsDocument>>> = TERMS_DOCUMENTS,
): LegalDraft<TermsDocument> | null {
    if (!version || !hasVersion(registry, version)) return null
    return registry[version]
}

/** The newest shipped document. */
export function latestTermsDocument(): LegalDraft<TermsDocument> {
    return TERMS_DOCUMENTS[LATEST_TERMS_VERSION]
}

/**
 * The document the Terms page shows: the server's version when the SPA ships
 * it, otherwise the newest shipped one.
 */
export function displayedTermsDocument(version: string | null | undefined): LegalDraft<TermsDocument> {
    return termsDocumentFor(version) ?? latestTermsDocument()
}
