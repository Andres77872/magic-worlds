/**
 * R2-FE-01 release act (15 §10): "flip PRIVACY_VOICE_VARIANT, mark the drafts
 * final". The in-app drafts (13 §5.8) replace `warning.voice`,
 * `call.screen.privacyNote` and `docs.guides.voice.record.body` once the
 * Privacy variant is published AND the draft is final; the consent
 * `noRecordings` line follows the final `voice-v2` copy. Since I-71
 * (2026-10-14) both switches are on: the Privacy page publishes the ElevenLabs
 * variant and `voice-v2` is final. The in-app drafts are still drafts, so
 * every one of those keys keeps its exact locale text.
 */
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { en } from '@/app/i18n/locales/en'
import { es } from '@/app/i18n/locales/es'
import {
    CONSENT_COPY,
    IN_APP_COPY_DRAFTS,
    IN_APP_COPY_SWITCHES,
    PRIVACY_FLIP_DRAFT_IDS,
    inAppCopyOverlay,
    installInAppCopyRelease,
    isInAppCopyReleased,
    releasedInAppCopy,
    type InAppCopyDraftId,
    type InAppCopySwitches,
} from './consentCopy'
import { LEGAL_PENDING, isShippable } from './legalPending'
import { PRIVACY_VOICE_VARIANT, PRIVACY_VOICE_VARIANTS } from './privacyVoiceCopy'

const IDS = Object.keys(IN_APP_COPY_DRAFTS) as InAppCopyDraftId[]

function lookup(root: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        root,
    )
}

/** The drafts as they will be once each one is marked final. */
const FINAL_DRAFTS = Object.fromEntries(IDS.map((id) => [id, { ...IN_APP_COPY_DRAFTS[id], status: 'final' as const }])) as typeof IN_APP_COPY_DRAFTS
/** Both switches off: an unpublished Privacy variant and an unsigned consent copy. */
const OFF: InAppCopySwitches = {
    privacy: { ...PRIVACY_VOICE_VARIANTS[PRIVACY_VOICE_VARIANT], status: 'draft' },
    consentV2: { ...CONSENT_COPY['voice-v2'], status: 'draft' },
}
/** A third locale's own line (none ships today). */
const FR_VOICE = 'Narration vocale (fr)'

describe('in-app copy release switches as shipped (I-71)', () => {
    it('are on: the ElevenLabs Privacy variant is published and voice-v2 is final', () => {
        expect(PRIVACY_VOICE_VARIANT).toBe('elevenlabsOnly')
        expect(IN_APP_COPY_SWITCHES.privacy).toBe(PRIVACY_VOICE_VARIANTS.elevenlabsOnly)
        expect(IN_APP_COPY_SWITCHES.consentV2).toBe(CONSENT_COPY['voice-v2'])
        expect(isShippable(IN_APP_COPY_SWITCHES.privacy)).toBe(true)
        expect(CONSENT_COPY['voice-v2'].status).toBe('final')
        expect(isShippable(IN_APP_COPY_SWITCHES.consentV2)).toBe(true)
    })

    it('release nothing while the in-app drafts are drafts: the overlay is empty', () => {
        for (const id of IDS) {
            expect(IN_APP_COPY_DRAFTS[id].status).toBe('draft')
            expect(isInAppCopyReleased(id)).toBe(false)
            expect(releasedInAppCopy(id, 'en')).toBeNull()
            expect(releasedInAppCopy(id, 'es')).toBeNull()
        }
        expect(inAppCopyOverlay('en')).toEqual({})
        expect(inAppCopyOverlay('es')).toEqual({})
    })

    it('install nothing on i18n (no bundle write, no listener)', () => {
        const fake = { addResourceBundle: vi.fn(), hasResourceBundle: vi.fn(() => true), on: vi.fn() }
        expect(installInAppCopyRelease(fake as never)).toBe(false)
        expect(fake.addResourceBundle).not.toHaveBeenCalled()
        expect(fake.on).not.toHaveBeenCalled()
    })

    it('leave every swapped key byte-identical to the locale files in the app i18n', () => {
        for (const id of IDS) {
            const key = IN_APP_COPY_DRAFTS[id].id
            expect(typeof lookup(en, key)).toBe('string')
            expect(i18n.t(key, { lng: 'en' })).toBe(lookup(en, key))
            expect(i18n.t(key, { lng: 'es' })).toBe(lookup(es, key))
            expect(i18n.t(key, { lng: 'en' })).not.toBe(IN_APP_COPY_DRAFTS[id].en.text)
        }
    })
})

describe('the release act', () => {
    it('releases the Privacy-flip lines once the draft is final, with the shipped switches', () => {
        for (const id of PRIVACY_FLIP_DRAFT_IDS) {
            expect(isInAppCopyReleased(id, IN_APP_COPY_SWITCHES, FINAL_DRAFTS)).toBe(true)
            expect(releasedInAppCopy(id, 'es', IN_APP_COPY_SWITCHES, FINAL_DRAFTS)).toBe(IN_APP_COPY_DRAFTS[id].es.text)
            // Half an act changes nothing.
            expect(isInAppCopyReleased(id, IN_APP_COPY_SWITCHES, IN_APP_COPY_DRAFTS)).toBe(false)
            expect(isInAppCopyReleased(id, { ...IN_APP_COPY_SWITCHES, privacy: OFF.privacy }, FINAL_DRAFTS)).toBe(false)
        }
    })

    it('releases the consent line with the final voice-v2 copy, not with the Privacy variant', () => {
        expect(isInAppCopyReleased('consentNoRecordings', IN_APP_COPY_SWITCHES, FINAL_DRAFTS)).toBe(true)
        expect(isInAppCopyReleased('consentNoRecordings', { ...IN_APP_COPY_SWITCHES, consentV2: OFF.consentV2 }, FINAL_DRAFTS)).toBe(false)
        expect(isInAppCopyReleased('consentNoRecordings', { ...OFF, consentV2: IN_APP_COPY_SWITCHES.consentV2 }, FINAL_DRAFTS)).toBe(true)
        expect(inAppCopyOverlay('en', IN_APP_COPY_SWITCHES, FINAL_DRAFTS)).not.toHaveProperty(['interaction'])
        for (const id of IDS) expect(isInAppCopyReleased(id, OFF, FINAL_DRAFTS), id).toBe(false)
    })

    it('never releases a final draft that still carries the counsel marker', () => {
        const marked = { ...FINAL_DRAFTS, warningVoice: { ...FINAL_DRAFTS.warningVoice, en: { text: `Voice ${LEGAL_PENDING}` } } }
        expect(isInAppCopyReleased('warningVoice', IN_APP_COPY_SWITCHES, marked)).toBe(false)
    })

    it('builds the overlay on each draft’s locale key', () => {
        expect(inAppCopyOverlay('en', IN_APP_COPY_SWITCHES, FINAL_DRAFTS)).toEqual({
            warning: { voice: IN_APP_COPY_DRAFTS.warningVoice.en.text },
            call: { screen: { privacyNote: IN_APP_COPY_DRAFTS.callPrivacyNote.en.text } },
            docs: { guides: { voice: { record: { body: IN_APP_COPY_DRAFTS.docsVoiceRecord.en.text } } } },
        })
    })

    it('swaps the keys in a running i18n, en at once and es when it loads, leaving siblings alone', async () => {
        const bundled = { en: lookup(en, 'warning.voice'), es: lookup(es, 'warning.voice') }
        const instance = i18next.createInstance()
        await instance
            .use({
                type: 'backend',
                init() {},
                read(language: string, _ns: string, callback: (error: unknown, data: unknown) => void) {
                    callback(null, language === 'es' ? es : language === 'fr' ? { warning: { voice: FR_VOICE } } : {})
                },
            })
            .init({ resources: { en: { translation: en } }, partialBundledLanguages: true, lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false } })

        expect(installInAppCopyRelease(instance, IN_APP_COPY_SWITCHES, FINAL_DRAFTS)).toBe(true)
        expect(instance.t('warning.voice')).toBe(IN_APP_COPY_DRAFTS.warningVoice.en.text)
        expect(instance.t('call.screen.privacyNote')).toBe(IN_APP_COPY_DRAFTS.callPrivacyNote.en.text)
        expect(instance.t('docs.guides.voice.record.body')).toBe(IN_APP_COPY_DRAFTS.docsVoiceRecord.en.text)
        // Siblings and the consent line (voice-v2 only, in the consent modal) are untouched.
        expect(instance.t('docs.guides.voice.record.title')).toBe(lookup(en, 'docs.guides.voice.record.title'))
        expect(instance.t('call.transcript.privacyNote')).toBe(lookup(en, 'call.transcript.privacyNote'))
        expect(instance.t('interaction.voiceConsent.disclosures.noRecordings')).toBe(lookup(en, 'interaction.voiceConsent.disclosures.noRecordings'))

        await instance.changeLanguage('es')
        expect(instance.t('warning.voice')).toBe(IN_APP_COPY_DRAFTS.warningVoice.es.text)
        expect(instance.t('call.screen.privacyNote')).toBe(IN_APP_COPY_DRAFTS.callPrivacyNote.es.text)
        expect(instance.t('docs.guides.voice.record.body')).toBe(IN_APP_COPY_DRAFTS.docsVoiceRecord.es.text)
        expect(instance.t('warning.authRequired')).toBe(lookup(es, 'warning.authRequired'))

        // Copy-on-write: i18next holds the en and es modules by reference; neither is written to.
        expect(lookup(en, 'warning.voice')).toBe(bundled.en)
        expect(lookup(es, 'warning.voice')).toBe(bundled.es)
        expect(lookup(en, 'call.screen.privacyNote')).not.toBe(IN_APP_COPY_DRAFTS.callPrivacyNote.en.text)

        // Another locale keeps its own strings: the legal lines ship in en and es only.
        await instance.changeLanguage('fr')
        expect(instance.t('warning.voice')).toBe(FR_VOICE)
        expect(instance.getResourceBundle('fr', 'translation')).toEqual({ warning: { voice: FR_VOICE } })
    })
})
