import { describe, expect, it } from 'vitest'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import { LEGAL_PENDING, containsLegalPending, isShippable, type LegalDraft } from './legalPending'
import { PRIVACY_VOICE_LOCALE_KEYS, PRIVACY_VOICE_VARIANT, PRIVACY_VOICE_VARIANTS, privacyVoiceCopy, type PrivacyVoiceCopy } from './privacyVoiceCopy'

function lookup(root: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        root,
    )
}

describe('privacy voice copy variants', () => {
    it('wires the ElevenLabs variant (I-71), so the Privacy page shows it in en and es', () => {
        expect(PRIVACY_VOICE_VARIANT).toBe('elevenlabsOnly')
        expect(privacyVoiceCopy('en')).toBe(PRIVACY_VOICE_VARIANTS.elevenlabsOnly.en)
        expect(privacyVoiceCopy('es')).toBe(PRIVACY_VOICE_VARIANTS.elevenlabsOnly.es)
    })

    it('keeps the published locale text identical to the wired variant, word for word', () => {
        for (const [language, locale] of [['en', en], ['es', es]] as const) {
            const copy = PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT][language]
            expect(lookup(locale, PRIVACY_VOICE_LOCALE_KEYS.title)).toBe(copy.title)
            expect(PRIVACY_VOICE_LOCALE_KEYS.body.map((key) => lookup(locale, key))).toEqual(copy.body)
        }
    })

    it('keeps only the ElevenLabs variant (I-68, I-71)', () => {
        expect(Object.keys(PRIVACY_VOICE_VARIANTS)).toEqual(['elevenlabsOnly'])
    })

    it('ships the ElevenLabs copy final and marker-free, naming each provider in both languages', () => {
        const doc = PRIVACY_VOICE_VARIANTS.elevenlabsOnly
        expect(doc.status).toBe('final')
        expect(containsLegalPending(doc)).toBe(false)
        expect(isShippable(doc)).toBe(true)
        for (const language of ['en', 'es'] as const) {
            const text = doc[language].body.join(' ')
            expect(text).toContain('ElevenLabs')
            expect(text).toContain('Groq')
            expect(doc[language].body).toHaveLength(PRIVACY_VOICE_LOCALE_KEYS.body.length)
        }
        // Narration is a voice surface too (13 §5.8), not calls only.
        expect(doc.en.title).toMatch(/narration/i)
        expect(doc.es.title).toMatch(/narración/i)
    })

    it('answers null for a document that is not shippable (the page then shows the locale text)', () => {
        const published = PRIVACY_VOICE_VARIANTS.elevenlabsOnly
        const unsigned: LegalDraft<PrivacyVoiceCopy> = { ...published, id: 'privacy-voice-unsigned', status: 'draft' }
        const marked: LegalDraft<PrivacyVoiceCopy> = {
            ...published,
            id: 'privacy-voice-marked',
            en: { ...published.en, body: [LEGAL_PENDING] },
        }
        for (const doc of [unsigned, marked]) {
            expect(privacyVoiceCopy('en', doc), doc.id).toBeNull()
            expect(privacyVoiceCopy('es', doc), doc.id).toBeNull()
        }
        expect(privacyVoiceCopy('es', published)).toBe(published.es)
    })
})
