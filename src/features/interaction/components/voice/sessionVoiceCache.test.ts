import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    clearSessionVoicesCache,
    invalidateSessionVoices,
    loadSessionVoices,
    sessionVoicesKey,
    sessionVoicesVersion,
    subscribeSessionVoices,
} from './sessionVoiceCache'

const KEY = `vk_${'a'.repeat(32)}`

const response = {
    ref_type: 'session',
    ref_id: '9',
    voices: [
        { json_path: 'character.voice', effective_voice: { voice_key: KEY, display_name: 'Aria', provider_route: 'elevenlabs', substitution_reason: null, flags: [], badges: [] } },
        { json_path: 'persona.voice', effective_voice: { provider_route: 'unknown' } },
        { json_path: 7, effective_voice: { voice_key: KEY, display_name: 'x', provider_route: 'elevenlabs' } },
    ],
}

afterEach(() => clearSessionVoicesCache())

describe('sessionVoiceCache', () => {
    it('reads the session ref once per key and keeps only readable projections', async () => {
        const getEffectiveVoice = vi.fn().mockResolvedValue(response)
        const key = sessionVoicesKey('ws-1', 9)
        const [first, second] = await Promise.all([
            loadSessionVoices({ getEffectiveVoice }, key, 9),
            loadSessionVoices({ getEffectiveVoice }, key, 9),
        ])
        expect(getEffectiveVoice).toHaveBeenCalledTimes(1)
        expect(getEffectiveVoice).toHaveBeenCalledWith('session', '9')
        expect(first).toBe(second)
        expect([...first.keys()]).toEqual(['character.voice'])
        expect(first.get('character.voice')?.display_name).toBe('Aria')
    })

    it('does not keep a failed read (a 404)', async () => {
        const getEffectiveVoice = vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(response)
        const key = sessionVoicesKey('ws-1', 9)
        await expect(loadSessionVoices({ getEffectiveVoice }, key, 9)).rejects.toThrow('404')
        await loadSessionVoices({ getEffectiveVoice }, key, 9)
        expect(getEffectiveVoice).toHaveBeenCalledTimes(2)
    })

    it('rejects when the client cannot read effective voices', async () => {
        await expect(loadSessionVoices({}, sessionVoicesKey('ws-1', 3), 3)).rejects.toThrow()
    })

    it('invalidation drops the entry and notifies readers', async () => {
        const getEffectiveVoice = vi.fn().mockResolvedValue(response)
        const key = sessionVoicesKey('ws-1', 9)
        await loadSessionVoices({ getEffectiveVoice }, key, 9)
        const listener = vi.fn()
        const unsubscribe = subscribeSessionVoices(listener)
        const before = sessionVoicesVersion()
        invalidateSessionVoices(key)
        expect(listener).toHaveBeenCalledTimes(1)
        expect(sessionVoicesVersion()).toBe(before + 1)
        await loadSessionVoices({ getEffectiveVoice }, key, 9)
        expect(getEffectiveVoice).toHaveBeenCalledTimes(2)
        unsubscribe()
        invalidateSessionVoices(key)
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
