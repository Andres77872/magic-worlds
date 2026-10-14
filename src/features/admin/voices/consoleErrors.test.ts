import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { ApiError } from '@/infrastructure/api'
import { i18n } from '@/app/i18n'
import { describeConsoleError } from './consoleErrors'
import { parsePublishFailure, publishFailures } from './publishFailures'

const t = ((key: string) => key) as unknown as TFunction
const en = i18n.getFixedT('en') as unknown as TFunction
const es = i18n.getFixedT('es') as unknown as TFunction
const names: Record<string, string> = { en: 'English', es: 'Spanish' }
const languageName = (code: string) => names[code] ?? code

describe('describeConsoleError', () => {
    it('maps the I-15 refusal (422 gain_out_of_range) to its own copy', () => {
        const error = new ApiError(422, 'gain_db -8.0 below -6', { code: 'gain_out_of_range', requestId: 'r-1' })
        expect(describeConsoleError(error, t)).toEqual({ message: 'admin.voices.errors.gainOutOfRange', configuration: false, requestId: 'r-1' })
    })

    it('keeps the server reason for other 422s and raises the banner for key problems', () => {
        expect(describeConsoleError(new ApiError(422, 'daily_quantity_limit_required'), t).message).toBe('daily_quantity_limit_required')
        expect(describeConsoleError(new ApiError(403, 'bad key', { code: 'invalid_api_key' }), t)).toMatchObject({ configuration: true })
        expect(describeConsoleError(new Error('boom'), t).message).toBe('admin.voices.errors.generic')
    })

    it('gives the renamed R0 console codes their own copy', () => {
        expect(describeConsoleError(new ApiError(404, 'No catalog voice with this key.', { code: 'catalog_voice_not_found' }), t).message).toBe('admin.voices.errors.catalogVoiceNotFound')
        expect(describeConsoleError(new ApiError(422, 'This model is not available in the lab.', { code: 'model_not_allowed' }), t).message).toBe('admin.voices.errors.modelNotAllowed')
        expect(describeConsoleError(new ApiError(422, 'No acceptance scripts exist.', { code: 'acceptance_scripts_missing' }), t).message).toBe('admin.voices.errors.acceptanceScriptsMissing')
        expect(describeConsoleError(new ApiError(422, 'x', { code: 'unsupported_output_format' }), t).message).toBe('admin.voices.errors.unsupportedOutputFormat')
    })

    it('gives the global preset refusals (EP-5) their own copy, in both locales', () => {
        const notEligible = new ApiError(422, 'Voice is not eligible.', { code: 'voice_not_eligible', details: { code: 'voice_not_eligible', path: 'voice' } })
        expect(describeConsoleError(notEligible, en).message).toBe('This voice cannot back a global preset: it must be active in the catalog and accepted on Flash.')
        expect(describeConsoleError(notEligible, es).message).toBe('Esta voz no puede respaldar un preset global: debe estar activa en el catálogo y aceptada en Flash.')
        expect(describeConsoleError(new ApiError(409, 'x', { code: 'global_preset_seed_exists' }), t).message).toBe('admin.voices.globalPresets.errors.seedExists')
        expect(describeConsoleError(new ApiError(409, 'x', { code: 'global_preset_legacy' }), t).message).toBe('admin.voices.globalPresets.errors.legacyReadOnly')
    })

    it('gives the library sort and locale refusals their own copy, in both locales', () => {
        const sort = new ApiError(422, 'sort must be one of cloned_by_count, created_date, trending, usage_character_count_1y.', { code: 'library_sort_unsupported' })
        const locale = new ApiError(422, 'locale must be a language tag such as es-AR.', { code: 'library_locale_invalid' })
        expect(describeConsoleError(sort, en).message).toBe('The voice library cannot sort that way. Pick another order.')
        expect(describeConsoleError(sort, es).message).toBe('La biblioteca de voces no puede ordenar de esa forma. Elige otro orden.')
        expect(describeConsoleError(locale, en).message).toBe('The locale must be a language tag, such as es-AR.')
        expect(describeConsoleError(locale, es).message).toBe('La variante regional debe ser una etiqueta de idioma, como es-AR.')
    })

    it('names the server text limit of text_over_model_limit, in both locales', () => {
        const error = new ApiError(422, 'The text is longer than the model accepts.', {
            code: 'text_over_model_limit',
            details: { code: 'text_over_model_limit', message: 'The text is longer than the model accepts.', max_chars: 1200 },
        })
        expect(describeConsoleError(error, en).message).toBe('The text is longer than this model accepts (1200 characters at most). Shorten it and try again.')
        expect(describeConsoleError(error, es).message).toBe('El texto es más largo de lo que admite este modelo (como máximo 1200 caracteres). Acórtalo e inténtalo de nuevo.')
        expect(describeConsoleError(new ApiError(422, 'x', { code: 'text_over_model_limit' }), en).message).toBe('The text is longer than this model accepts. Shorten it and try again.')
    })

    it('lists every publish refusal with its language, and a replacement refusal by its own code', () => {
        const error = new ApiError(422, 'The voice does not meet the publish rules.', {
            code: 'publish_precondition_failed',
            details: { failed: ['expressive_not_passed:es', 'no_expressive_sample:en', 'ivc_publish_blocked'] },
        })
        expect(describeConsoleError(error, en, languageName).message).toBe(
            'The voice does not meet the publish rules. Expressive (v4) has no pass in Spanish. No own Expressive showcase sample in English. Instant clones are not published until P-15 is answered.',
        )
        expect(describeConsoleError(new ApiError(422, 'The replacement voice is not valid for this voice.', { code: 'replacement_not_call_eligible' }), es).message).toBe(
            'La voz de reemplazo no es apta para llamadas.',
        )
        expect(describeConsoleError(new ApiError(409, 'x', { code: 'voice_is_replacement' }), en).message).toBe(
            'This voice is the replacement of another voice. Change that replacement first.',
        )
    })
})

describe('publishFailures', () => {
    it('splits the language suffix and keeps unknown codes', () => {
        expect(parsePublishFailure('call_consistency_low:es')).toEqual({ code: 'call_consistency_low', language: 'es' })
        expect(parsePublishFailure('source_not_allowed')).toEqual({ code: 'source_not_allowed', language: null })
        const error = new ApiError(422, 'x', { code: 'publish_precondition_failed', details: { failed: ['no_own_sample:fr', 42, '', 'new_rule'] } })
        expect(publishFailures(error)).toEqual([
            { code: 'no_own_sample', language: 'fr' },
            { code: 'new_rule', language: null },
        ])
        expect(publishFailures(new ApiError(422, 'x', { code: 'gain_out_of_range' }))).toBeNull()
        expect(publishFailures(new Error('x'))).toBeNull()
    })

    it('carries the dependent voices of a voice_is_replacement refusal (I-29)', () => {
        const error = new ApiError(409, 'Other voices use this voice as their replacement.', {
            code: 'voice_is_replacement',
            details: {
                code: 'voice_is_replacement',
                dependent_voice_keys: ['vk_a', 7, '', 'vk_b'],
                reasons: { vk_a: 'replacement_not_active', vk_b: 'replacement_not_active' },
            },
        })
        expect(publishFailures(error)).toEqual([{ code: 'voice_is_replacement', language: null, dependentVoiceKeys: ['vk_a', 'vk_b'] }])
        expect(publishFailures(new ApiError(409, 'x', { code: 'voice_is_replacement' }))).toEqual([{ code: 'voice_is_replacement', language: null }])
    })
})

describe('describeConsoleError: lab, acceptance and repoint codes', () => {
    const cases: [number, string, string][] = [
        [422, 'text_empty', 'admin.voices.errors.textEmpty'],
        [422, 'script_version_mismatch', 'admin.voices.errors.scriptVersionMismatch'],
        [422, 'repoint_target_invalid', 'admin.voices.errors.repointTargetInvalid'],
        [409, 'voice_unavailable', 'admin.voices.errors.voiceUnavailable'],
        [503, 'synthesis_unavailable', 'admin.voices.errors.synthesisUnavailable'],
        [503, 'spend_circuit_open', 'admin.voices.errors.spendCircuitOpen'],
        [503, 'provider_unavailable', 'admin.voices.errors.providerUnavailable'],
        [503, 'provider_busy', 'admin.voices.errors.providerBusy'],
        [422, 'provider_rejected', 'admin.voices.errors.providerRejected'],
        [502, 'provider_error', 'admin.voices.errors.providerError'],
    ]
    it.each(cases)('maps %i %s to its own copy, never the server text', (status, code, key) => {
        expect(describeConsoleError(new ApiError(status, 'English server text.', { code }), t).message).toBe(key)
        expect(describeConsoleError(new ApiError(status, 'English server text.', { code }), es).message).not.toBe('English server text.')
    })

    it('words text_rejected by its pipeline reason, in both locales', () => {
        const rejected = (reason?: string) =>
            new ApiError(422, 'The text could not be prepared for speech.', { code: 'text_rejected', details: { code: 'text_rejected', ...(reason ? { reason } : {}) } })
        expect(describeConsoleError(rejected('markup'), t).message).toBe('admin.voices.errors.textRejectedMarkup')
        expect(describeConsoleError(rejected('markup_overflow'), t).message).toBe('admin.voices.errors.textRejectedOverflow')
        expect(describeConsoleError(rejected('tag_contract'), t).message).toBe('admin.voices.errors.textRejectedTagContract')
        expect(describeConsoleError(rejected('not_text'), t).message).toBe('admin.voices.errors.textRejected')
        expect(describeConsoleError(rejected(), en).message).toBe('The text could not be prepared for speech. Check it and try again.')
        expect(describeConsoleError(rejected('tag_contract'), es).message).toBe('Este modelo no puede pronunciar una etiqueta del texto. Quítala o elige un modelo que la admita.')
    })
})
