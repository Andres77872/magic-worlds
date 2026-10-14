/**
 * The legal ship gate (R2-FE-01). Copy counsel has not written carries
 * LEGAL_PENDING; this test keeps it out of everything a user can see:
 * the wired privacy variant, every `final` document, and the locale files.
 * Flipping the privacy variant or marking a document final therefore
 * requires replacing every marker first.
 */
import { describe, expect, it } from 'vitest'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import { minorReportsEn, minorReportsEs } from '@/app/i18n/locales/minorReports'
import { voiceSafetyEn, voiceSafetyEs } from '@/app/i18n/locales/voiceSafety'
import { CRISIS_RESOURCES } from '@/features/safety/crisisResources'
import { CONSENT_COPY, IN_APP_COPY_DRAFTS, IN_APP_COPY_SWITCHES, consentCopyFor } from './consentCopy'
import { LEGAL_PENDING, containsLegalPending, isShippable, shippable, type LegalDraft } from './legalPending'
import { PRIVACY_VOICE_VARIANT, PRIVACY_VOICE_VARIANTS, privacyVoiceCopy, type PrivacyVoiceCopy } from './privacyVoiceCopy'
import { TERMS_DOCUMENTS } from './termsDocuments'

/** Every registry document, by a readable name. */
const DOCUMENTS: Array<[string, LegalDraft<unknown>]> = [
    ...Object.entries(TERMS_DOCUMENTS).map(([version, doc]): [string, LegalDraft<unknown>] => [`terms ${version}`, doc]),
    ...Object.entries(PRIVACY_VOICE_VARIANTS).map(([variant, doc]): [string, LegalDraft<unknown>] => [`privacy ${variant}`, doc]),
    ...Object.entries(CONSENT_COPY).map(([version, doc]): [string, LegalDraft<unknown>] => [`consent ${version}`, doc]),
    ...Object.entries(IN_APP_COPY_DRAFTS).map(([id, doc]): [string, LegalDraft<unknown>] => [`in-app ${id}`, doc]),
    ['crisis resources', CRISIS_RESOURCES],
]

describe('legal ship gate', () => {
    it('finds the marker anywhere in a nested value (self-test)', () => {
        expect(containsLegalPending(LEGAL_PENDING)).toBe(true)
        expect(containsLegalPending({ a: [{ b: { c: `text ${LEGAL_PENDING} text` } }] })).toBe(true)
        expect(containsLegalPending([['x'], { y: ['z'] }])).toBe(false)
        expect(containsLegalPending(null)).toBe(false)
        const cyclic: Record<string, unknown> = { text: 'fine' }
        cyclic.self = cyclic
        expect(containsLegalPending(cyclic)).toBe(false)
        const draft = { id: 'self-test', status: 'final' as const, en: { body: LEGAL_PENDING }, es: { body: 'ok' } }
        expect(isShippable(draft)).toBe(false)
    })

    it('keeps the marker out of the wired privacy variant', () => {
        expect(containsLegalPending(PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT])).toBe(false)
        for (const language of ['en', 'es'] as const) {
            const copy = privacyVoiceCopy(language)
            expect(copy, language).not.toBeNull()
            expect(containsLegalPending(copy)).toBe(false)
        }
    })

    it('wires only a final privacy variant: the ElevenLabs text, published (I-71)', () => {
        const wired = PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT]
        expect(PRIVACY_VOICE_VARIANT).toBe('elevenlabsOnly')
        expect(wired.status).toBe('final')
        expect(isShippable(wired)).toBe(true)
        expect(privacyVoiceCopy('en')).toBe(wired.en)
        expect(privacyVoiceCopy('es')).toBe(wired.es)
    })

    it('ships the consent copy the BFF requires as final, and switches the in-app release on (I-71)', () => {
        expect(consentCopyFor().status).toBe('final')
        expect(isShippable(consentCopyFor())).toBe(true)
        expect(IN_APP_COPY_SWITCHES.privacy).toBe(PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT])
        expect(IN_APP_COPY_SWITCHES.consentV2).toBe(consentCopyFor())
    })

    it.each(DOCUMENTS)('ships %s only when final documents are marker-free', (_name, doc) => {
        expect(doc.en).toBeDefined()
        expect(doc.es).toBeDefined()
        if (doc.status === 'final') expect(containsLegalPending(doc)).toBe(false)
    })

    it('gives every final Terms of Service version an effective date in both languages', () => {
        for (const doc of Object.values(TERMS_DOCUMENTS)) {
            if (doc.status !== 'final') continue
            expect(doc.en.effectiveDate, doc.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(doc.es.effectiveDate, doc.id).toBe(doc.en.effectiveDate)
        }
    })

    it('never puts the marker in the locale files', () => {
        expect(containsLegalPending(en)).toBe(false)
        expect(containsLegalPending(es)).toBe(false)
        // Modules G spreads into en/es (checked directly until the spreads land).
        expect(containsLegalPending([voiceSafetyEn, voiceSafetyEs, minorReportsEn, minorReportsEs])).toBe(false)
    })

    it('falls back from a draft to the published document at runtime', () => {
        const published = PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT]
        // Unshippable variants: a draft whose prose carries the marker mid-sentence, a
        // marker-free draft (refused on status alone) and a final one that still carries
        // the marker (refused on the marker alone).
        const prose = (text: string): PrivacyVoiceCopy => ({ title: published.en.title, body: [text, ...published.en.body.slice(1)] })
        const markedDraft: LegalDraft<PrivacyVoiceCopy> = {
            id: 'privacy-voice-marked-draft',
            status: 'draft',
            en: prose(`Character replies are spoken by AI voices. Before any text is spoken, an automated safety check run by ${LEGAL_PENDING} reviews it.`),
            es: prose(`Las respuestas de los personajes las pronuncian voces de IA. Antes de pronunciar cualquier texto, una revisión de seguridad automática de ${LEGAL_PENDING} lo revisa.`),
        }
        const unsignedDraft: LegalDraft<PrivacyVoiceCopy> = { id: 'privacy-voice-unsigned', status: 'draft', en: published.en, es: published.es }
        const markedFinal: LegalDraft<PrivacyVoiceCopy> = { ...markedDraft, id: 'privacy-voice-marked-final', status: 'final' }
        for (const draft of [markedDraft, unsignedDraft, markedFinal]) {
            expect(isShippable(draft), draft.id).toBe(false)
            expect(shippable(draft, published), draft.id).toBe(published)
            expect(shippable(published, draft), draft.id).toBe(published)
            // The Privacy page never shows it: the section falls back to the published locale text.
            expect(privacyVoiceCopy('en', draft), draft.id).toBeNull()
            expect(privacyVoiceCopy('es', draft), draft.id).toBeNull()
        }
    })
})
