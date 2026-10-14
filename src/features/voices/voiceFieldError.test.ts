import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import { voiceFieldErrorKey } from './voiceFieldError'

const refusal = (status: number, code?: string, viaDetails = false) =>
    Object.assign(new Error('Refused'), viaDetails ? { status, details: { code, path: 'voice' } } : { status, code })

describe('voiceFieldErrorKey (05 §7.4)', () => {
    it('maps a 422 eligibility refusal of the picked voice to the field copy', () => {
        expect(voiceFieldErrorKey(refusal(422, 'voice_not_eligible'))).toBe('voices.picker.eligibilityError')
        expect(voiceFieldErrorKey(refusal(422, 'voice_not_eligible', true))).toBe('voices.picker.eligibilityError')
        expect(voiceFieldErrorKey(refusal(422, 'voice_plan_locked'))).toBe('voices.errors.planLocked')
    })

    it('leaves every other failure to the form error', () => {
        expect(voiceFieldErrorKey(refusal(409, 'voice_not_eligible'))).toBeNull()
        expect(voiceFieldErrorKey(refusal(409, 'voice_reload_required'))).toBeNull()
        // A refused V1 write stays a form-only message.
        expect(voiceFieldErrorKey(refusal(422, 'voice_v1_not_allowed'))).toBeNull()
        expect(voiceFieldErrorKey(refusal(422, 'voice_invalid'))).toBeNull()
        expect(voiceFieldErrorKey(refusal(422))).toBeNull()
        expect(voiceFieldErrorKey(new Error('offline'))).toBeNull()
        expect(voiceFieldErrorKey(null)).toBeNull()
    })

    it('has the 05 §9.3 copy in en and es', () => {
        expect(i18n.getFixedT('en')('voices.picker.eligibilityError')).toBe('This voice can’t be picked right now. Choose another.')
        expect(i18n.getFixedT('es')('voices.picker.eligibilityError')).toBe('Esta voz no se puede elegir ahora mismo. Elige otra.')
    })
})
