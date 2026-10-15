import { describe, expect, it } from 'vitest'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import { CONSENT_COPY, CURRENT_CONSENT_VERSION, consentCopyFor } from './consentCopy'
import { containsLegalPending, isShippable } from './legalPending'

function lookup(root: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        root,
    )
}

describe('CONSENT_COPY', () => {
    it('keeps the published default and a separately selected Fish development draft', () => {
        expect(CURRENT_CONSENT_VERSION).toBe('voice-v2')
        expect(Object.keys(CONSENT_COPY).sort()).toEqual(['voice-v2', 'voice-v3'])
        expect(consentCopyFor()).toBe(CONSENT_COPY['voice-v2'])
        expect(consentCopyFor('voice-v3')).toBe(CONSENT_COPY['voice-v3'])
        expect(isShippable(CONSENT_COPY['voice-v3'])).toBe(false)
    })

    it('ships voice-v2 final and marker-free (I-71), naming ElevenLabs and Groq', () => {
        const v2 = CONSENT_COPY['voice-v2']
        expect(v2.status).toBe('final')
        expect(containsLegalPending(v2)).toBe(false)
        expect(isShippable(v2)).toBe(true)
        for (const language of ['en', 'es'] as const) {
            expect(v2[language].processing).toContain('ElevenLabs')
            expect(v2[language].processing).toContain('Groq')
        }
    })

    it('keeps no processing line in the locale files: the consent copy is the only source', () => {
        expect(lookup(en, 'interaction.voiceConsent.disclosures.processing')).toBeUndefined()
        expect(lookup(es, 'interaction.voiceConsent.disclosures.processing')).toBeUndefined()
    })
})
