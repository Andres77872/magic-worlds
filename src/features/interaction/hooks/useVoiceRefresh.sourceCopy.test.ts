/**
 * D36 / D39 (05 §7.8, §12; 09 §2.2, §4.11): a refresh whose source card is not in
 * the session's workspace says "The original card isn't in this workspace
 * anymore." (en+es). The BFF's `reason: no_voice` (the card has no voice) keeps
 * its own line.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { useVoiceRefresh, voiceRefreshErrorKey } from './useVoiceRefresh'

const SPEC_EN = 'The original card isn’t in this workspace anymore.'

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

describe('voice_source_unavailable copy', () => {
    it('maps the card-not-in-workspace refusal to the spec copy and no_voice to its own line', () => {
        expect(voiceRefreshErrorKey(new ApiError(409, 'gone', { code: 'voice_source_unavailable', details: { code: 'voice_source_unavailable', card_id: 'c1' } })))
            .toBe('voices.refresh.sourceUnavailable')
        expect(voiceRefreshErrorKey(new ApiError(409, 'gone', { code: 'voice_source_unavailable', details: { code: 'voice_source_unavailable', card_id: 'c1', reason: 'no_voice' } })))
            .toBe('voices.refresh.sourceNoVoice')
    })

    it('ships both lines in en and es', () => {
        expect(i18n.t('voices.refresh.sourceUnavailable', { lng: 'en' })).toBe(SPEC_EN)
        for (const key of ['voices.refresh.sourceUnavailable', 'voices.refresh.sourceNoVoice']) {
            expect(i18n.exists(key, { lng: 'en' })).toBe(true)
            expect(i18n.exists(key, { lng: 'es' })).toBe(true)
            expect(i18n.t(key, { lng: 'es' })).not.toBe(i18n.t(key, { lng: 'en' }))
        }
        expect(i18n.t('voices.refresh.sourceNoVoice', { lng: 'en' })).not.toBe(SPEC_EN)
    })

    it('shows the spec copy for a 409 from the refresh route', async () => {
        const { result } = renderHook(() => useVoiceRefresh())
        await act(async () => {
            await result.current.run(() => Promise.reject(new ApiError(409, 'gone', { code: 'voice_source_unavailable' })))
        })
        expect(result.current.status).toBe('error')
        expect(result.current.message).toBe(SPEC_EN)
    })
})
