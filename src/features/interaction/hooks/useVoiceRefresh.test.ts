import { act, renderHook } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { ApiError } from '@/infrastructure/api'
import { installVoiceNarrationCopy } from '@/test-utils/voiceNarrationCopy'
import { useVoiceRefresh, voiceRefreshErrorKey } from './useVoiceRefresh'

beforeAll(() => {
    installVoiceNarrationCopy()
})

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

describe('voiceRefreshErrorKey', () => {
    it.each([
        [new ApiError(409, 'busy', { code: 'voice_refresh_busy' }), 'voices.refresh.busyConflict'],
        [new ApiError(409, 'archived', { code: 'WORKSPACE_ARCHIVED' }), 'workspaceContent.saveErrors.archived'],
        [new ApiError(409, 'gone', { code: 'voice_source_unavailable' }), 'voices.refresh.sourceUnavailable'],
        [new ApiError(422, 'gone', { code: 'voice_source_unavailable' }), 'voices.refresh.sourceUnavailable'],
        [new ApiError(422, 'nope', { code: 'voice_not_eligible' }), 'voices.refresh.notEligible'],
        [new ApiError(422, 'validation'), 'voices.refresh.notEligible'],
        [new ApiError(500, 'boom'), 'voices.errors.budgetUnavailable'],
        [new Error('offline'), 'voices.errors.budgetUnavailable'],
    ])('maps %s', (error, key) => {
        expect(voiceRefreshErrorKey(error)).toBe(key)
    })
})

describe('useVoiceRefresh', () => {
    it('goes busy, then done', async () => {
        let resolve: (value: unknown) => void = () => {}
        const request = vi.fn(() => new Promise((done) => { resolve = done }))
        const { result } = renderHook(() => useVoiceRefresh())
        expect(result.current.status).toBe('idle')
        expect(result.current.message).toBeNull()
        let outcome: Promise<boolean> = Promise.resolve(false)
        act(() => {
            outcome = result.current.run(request)
        })
        expect(result.current.status).toBe('busy')
        expect(result.current.message).toBe('Updating voice…')
        // A second run while busy is ignored.
        let second = true
        await act(async () => {
            second = await result.current.run(request)
        })
        expect(second).toBe(false)
        expect(request).toHaveBeenCalledTimes(1)
        await act(async () => {
            resolve({})
            expect(await outcome).toBe(true)
        })
        expect(result.current.status).toBe('done')
        expect(result.current.message).toBe('Voice updated. New replies use it.')
        act(() => result.current.reset())
        expect(result.current.status).toBe('idle')
    })

    it('shows the busy-conflict copy for a 409 voice_refresh_busy', async () => {
        const { result } = renderHook(() => useVoiceRefresh())
        await act(async () => {
            expect(await result.current.run(() => Promise.reject(new ApiError(409, 'busy', { code: 'voice_refresh_busy' })))).toBe(false)
        })
        expect(result.current.status).toBe('error')
        expect(result.current.message).toBe('Finish the current reply or call first.')
    })
})
