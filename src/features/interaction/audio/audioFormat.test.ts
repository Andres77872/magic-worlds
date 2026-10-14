import { describe, expect, it, vi } from 'vitest'
import { chooseCallAudioSink, isPlayableCallChunk } from './audioFormat'

const chunk = (overrides: Record<string, unknown> = {}) => ({ content_type: 'audio/mpeg', codec: 'mp3', sample_rate: 44_100, channels: 1, ...overrides })

describe('isPlayableCallChunk', () => {
    it.each([22_050, 24_000, 44_100])('plays mono mp3 at %i Hz', (rate) => {
        expect(isPlayableCallChunk(chunk({ sample_rate: rate }))).toBe(true)
    })

    it('plays a chunk without a codec (older BFF build)', () => {
        expect(isPlayableCallChunk({ content_type: 'audio/mpeg', sample_rate: 44_100, channels: 1 })).toBe(true)
        expect(isPlayableCallChunk(chunk({ codec: null }))).toBe(true)
        expect(isPlayableCallChunk(chunk({ content_type: ' Audio/MPEG ' }))).toBe(true)
    })

    it.each([
        ['pcm content', { content_type: 'audio/pcm' }],
        ['wav content', { content_type: 'audio/wav' }],
        ['missing content type', { content_type: undefined }],
        ['opus codec', { codec: 'opus' }],
        ['an unknown rate', { sample_rate: 48_000 }],
        ['a string rate', { sample_rate: '44100' }],
        ['stereo', { channels: 2 }],
        ['missing channels', { channels: undefined }],
    ])('drops %s', (_label, overrides) => {
        expect(isPlayableCallChunk(chunk(overrides))).toBe(false)
    })

    it('drops a missing frame', () => {
        expect(isPlayableCallChunk(null)).toBe(false)
        expect(isPlayableCallChunk(undefined)).toBe(false)
    })
})

describe('chooseCallAudioSink', () => {
    it('keeps MediaSource when nothing is announced (older BFF build)', () => {
        const supports = vi.fn(() => false)
        expect(chooseCallAudioSink(undefined, supports)).toBe('mse')
        expect(chooseCallAudioSink(null, supports)).toBe('mse')
        expect(chooseCallAudioSink({ content_type: '  ' }, supports)).toBe('mse')
        expect(supports).not.toHaveBeenCalled()
    })

    it('streams through MediaSource when the type is supported', () => {
        const supports = vi.fn(() => true)
        expect(chooseCallAudioSink({ content_type: 'audio/mpeg', codec: 'mp3', sample_rate: 44_100, channels: 1 }, supports)).toBe('mse')
        expect(supports).toHaveBeenCalledWith('audio/mpeg')
    })

    it('falls back to Blob groups when MediaSource refuses the type', () => {
        expect(chooseCallAudioSink({ content_type: 'audio/mpeg' }, () => false)).toBe('blob')
    })

    it('reads the browser MediaSource support by default and survives a throwing check', () => {
        const original = globalThis.MediaSource
        try {
            globalThis.MediaSource = { isTypeSupported: () => { throw new Error('boom') } } as unknown as typeof MediaSource
            expect(chooseCallAudioSink({ content_type: 'audio/mpeg' })).toBe('blob')
            globalThis.MediaSource = { isTypeSupported: (type: string) => type === 'audio/mpeg' } as unknown as typeof MediaSource
            expect(chooseCallAudioSink({ content_type: 'audio/mpeg' })).toBe('mse')
        } finally {
            globalThis.MediaSource = original
        }
    })
})
