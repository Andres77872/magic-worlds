import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceReviewFlag } from '@/shared'
import { REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET } from '../fixtures'
import { useVoiceReviewFlags } from './useVoiceReviewFlags'

const listVoiceReviewFlags = vi.fn()
const dismissVoiceReviewFlag = vi.fn()

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listVoiceReviewFlags: (...args: unknown[]) => listVoiceReviewFlags(...args),
        dismissVoiceReviewFlag: (...args: unknown[]) => dismissVoiceReviewFlag(...args),
    },
}))

const CAST_FLAG: VoiceReviewFlag = { ...REVIEW_FLAG_CARD, flag_id: 13, ref_type: 'template_cast', ref_id: 'tpl-1', json_path: 'characters[card-9].voice' }

describe('useVoiceReviewFlags (R1-FE-03)', () => {
    beforeEach(() => {
        listVoiceReviewFlags.mockReset().mockResolvedValue({ items: [REVIEW_FLAG_CARD, REVIEW_FLAG_PRESET, CAST_FLAG] })
        dismissVoiceReviewFlag.mockReset().mockResolvedValue(undefined)
    })

    it('loads nothing while disabled', () => {
        const { result } = renderHook(() => useVoiceReviewFlags(false))
        expect(result.current.flags).toEqual([])
        expect(listVoiceReviewFlags).not.toHaveBeenCalled()
    })

    it('loads once and finds flags by ref', async () => {
        const { result } = renderHook(() => useVoiceReviewFlags())
        await waitFor(() => expect(result.current.flags).toHaveLength(3))
        expect(listVoiceReviewFlags).toHaveBeenCalledTimes(1)
        expect(result.current.flagFor('card', 'card-1')).toBe(REVIEW_FLAG_CARD)
        expect(result.current.flagFor('card', 'card-1', 'voice')).toBe(REVIEW_FLAG_CARD)
        expect(result.current.flagFor('card', 'card-1', 'narrator_voice')).toBeNull()
        expect(result.current.flagFor('preset', 'user-1', 'voice')).toBe(REVIEW_FLAG_PRESET)
        // A template's cast flags answer the cast path as a whole.
        expect(result.current.flagFor('template_cast', 'tpl-1', 'characters')).toBe(CAST_FLAG)
        expect(result.current.flagFor('card', null)).toBeNull()
        expect(result.current.flagsFor('preset')).toEqual([REVIEW_FLAG_PRESET])
    })

    it('dismisses at once and restores the flag when the server refuses', async () => {
        const { result } = renderHook(() => useVoiceReviewFlags(true))
        await waitFor(() => expect(result.current.flags).toHaveLength(3))

        await act(() => result.current.dismiss(REVIEW_FLAG_CARD.flag_id))
        expect(dismissVoiceReviewFlag).toHaveBeenCalledWith(REVIEW_FLAG_CARD.flag_id)
        expect(result.current.flagFor('card', 'card-1')).toBeNull()

        dismissVoiceReviewFlag.mockRejectedValueOnce(new Error('boom'))
        await act(() => result.current.dismiss(REVIEW_FLAG_PRESET.flag_id))
        expect(result.current.flagFor('preset', 'user-1')).toEqual(REVIEW_FLAG_PRESET)
        expect(result.current.dismissError).toBe('voices.notice.reviewFlagDismissFailed')
    })

    it('reads a failed list as no flags', async () => {
        listVoiceReviewFlags.mockRejectedValue(new Error('down'))
        const { result } = renderHook(() => useVoiceReviewFlags(true))
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.flags).toEqual([])
    })
})
