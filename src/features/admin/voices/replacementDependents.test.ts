import { describe, expect, it } from 'vitest'
import { ApiError } from '@/infrastructure/api'
import { replacementDependentsOf, replacementOrphans, repointRefusalOf } from './replacementDependents'

describe('replacementDependentsOf (409 voice_is_replacement, I-34)', () => {
    it('reads the dependent keys and their reasons, dropping junk', () => {
        const error = new ApiError(409, 'Other voices use this voice as their replacement.', {
            code: 'voice_is_replacement',
            details: {
                code: 'voice_is_replacement',
                dependent_voice_keys: ['vk_a', 7, '', 'vk_b', 'vk_a'],
                reasons: { vk_a: 'replacement_not_active', vk_b: 3, vk_other: 'replacement_mismatch' },
            },
        })
        expect(replacementDependentsOf(error)).toEqual({ keys: ['vk_a', 'vk_b'], reasons: { vk_a: 'replacement_not_active' } })
    })

    it('is null for another code, an empty list or a non-API error', () => {
        expect(replacementDependentsOf(new ApiError(409, 'x', { code: 'voice_is_replacement', details: { dependent_voice_keys: [] } }))).toBeNull()
        expect(replacementDependentsOf(new ApiError(409, 'x', { code: 'voice_is_replacement' }))).toBeNull()
        expect(replacementDependentsOf(new ApiError(409, 'x', { code: 'status_transition_not_allowed', details: { dependent_voice_keys: ['vk_a'] } }))).toBeNull()
        expect(replacementDependentsOf(new Error('x'))).toBeNull()
    })
})

describe('repointRefusalOf (422 repoint_target_invalid)', () => {
    it('names the dependent and the reason', () => {
        const error = new ApiError(422, 'x', { code: 'repoint_target_invalid', details: { code: 'repoint_target_invalid', voice_key: 'vk_a', reason: 'replacement_mismatch' } })
        expect(repointRefusalOf(error)).toEqual({ voiceKey: 'vk_a', reason: 'replacement_mismatch' })
    })

    it('has no dependent when the target is not a voice key', () => {
        const error = new ApiError(422, 'x', { code: 'repoint_target_invalid', details: { code: 'repoint_target_invalid', reason: 'replacement_not_found' } })
        expect(repointRefusalOf(error)).toEqual({ voiceKey: null, reason: 'replacement_not_found' })
        expect(repointRefusalOf(new ApiError(422, 'x', { code: 'repoint_target_invalid' }))).toEqual({ voiceKey: null, reason: null })
        expect(repointRefusalOf(new ApiError(422, 'x', { code: 'replacement_mismatch' }))).toBeNull()
    })
})

describe('replacementOrphans (sync detail)', () => {
    it.each([
        ['removed=1 present=0 errors=0 skipped=0 replacement_orphans=2', 2],
        ['replacement_orphans=0', 0],
        ['removed=3 replacement_orphans=12 extra=1', 12],
        ['lease_held', 0],
        ['not_replacement_orphans=4', 0],
        ['replacement_orphans=x', 0],
        [null, 0],
        [undefined, 0],
    ])('%s -> %i', (detail, expected) => {
        expect(replacementOrphans(detail)).toBe(expected)
    })
})
