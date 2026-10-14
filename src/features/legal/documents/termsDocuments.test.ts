import { describe, expect, it } from 'vitest'
import { termsPageEn, termsPageEs } from '@/app/i18n/locales/voiceAccess'
import type { LegalDraft } from './legalPending'
import {
    LATEST_TERMS_VERSION,
    TERMS_DOCUMENTS,
    TERMS_VERSION_PATTERN,
    displayedTermsDocument,
    latestTermsDocument,
    termsDocumentFor,
    type TermsDocument,
} from './termsDocuments'

describe('termsDocuments', () => {
    it('keys every document by a version the BFF accepts, matching its id', () => {
        const versions = Object.keys(TERMS_DOCUMENTS)
        expect(versions.length).toBeGreaterThan(0)
        for (const version of versions) {
            expect(version).toMatch(TERMS_VERSION_PATTERN)
            expect(TERMS_DOCUMENTS[version].id).toBe(version)
        }
        expect(TERMS_VERSION_PATTERN.source).toBe('^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
    })

    it('returns null for a version the SPA does not ship', () => {
        expect(termsDocumentFor('tos-v99')).toBeNull()
        expect(termsDocumentFor(null)).toBeNull()
        expect(termsDocumentFor(undefined)).toBeNull()
        expect(termsDocumentFor('')).toBeNull()
        // Never an inherited property.
        expect(termsDocumentFor('constructor')).toBeNull()
        expect(termsDocumentFor('toString')).toBeNull()
    })

    it('finds a shipped version, in any registry', () => {
        expect(termsDocumentFor('tos-v1')).toBe(TERMS_DOCUMENTS['tos-v1'])
        const v2: LegalDraft<TermsDocument> = { id: 'tos-v2', status: 'final', en: { sections: [], effectiveDate: '2027-01-15' }, es: { sections: [], effectiveDate: '2027-01-15' } }
        expect(termsDocumentFor('tos-v2', { ...TERMS_DOCUMENTS, 'tos-v2': v2 })).toBe(v2)
    })

    it('names the newest shipped document and falls back to it', () => {
        expect(TERMS_DOCUMENTS[LATEST_TERMS_VERSION]).toBeDefined()
        expect(latestTermsDocument().id).toBe(LATEST_TERMS_VERSION)
        expect(displayedTermsDocument('tos-v99').id).toBe(LATEST_TERMS_VERSION)
        expect(displayedTermsDocument(null).id).toBe(LATEST_TERMS_VERSION)
        expect(displayedTermsDocument('tos-v1').id).toBe('tos-v1')
    })

    it('keeps tos-v1 a draft whose text is the published outline, word for word', () => {
        const doc = TERMS_DOCUMENTS['tos-v1']
        expect(doc.status).toBe('draft')
        expect(doc.en.effectiveDate).toBeNull()
        expect(doc.en.sections.map((section) => section.id)).toEqual(['eligibility', 'acceptableUse', 'providers', 'enforcement', 'aiVoices', 'changes'])
        for (const [language, page] of [['en', termsPageEn], ['es', termsPageEs]] as const) {
            for (const section of doc[language].sections) {
                const copy = page.sections[section.id as keyof typeof page.sections]
                expect(section.title).toBe(copy.title)
                expect(section.body).toEqual([copy.body1])
            }
        }
    })
})
