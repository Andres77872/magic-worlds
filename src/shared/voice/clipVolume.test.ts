import { describe, expect, it } from 'vitest'
import { THOUGHT_GAIN, clipGainDb, clipVolume } from './clipVolume'

describe('clipVolume', () => {
    it('leaves a clip without gain_db at the user volume, thoughts included', () => {
        expect(clipVolume(0.8, undefined, 'speech')).toBe(0.8)
        expect(clipVolume(0.8, null, 'thought')).toBe(0.8)
        expect(clipVolume(1, Number.NaN, 'narrator')).toBe(1)
    })

    it('applies the gain in dB', () => {
        expect(clipVolume(1, -6, 'speech')).toBeCloseTo(0.5012, 4)
        expect(clipVolume(0.5, -20, 'narrator')).toBeCloseTo(0.05, 6)
        expect(clipVolume(1, 0, 'speech')).toBe(1)
    })

    it('dims thoughts by -3 dB on clips that carry a gain', () => {
        expect(clipVolume(1, 0, 'thought')).toBeCloseTo(THOUGHT_GAIN, 6)
        expect(clipVolume(0.5, -6, 'thought')).toBeCloseTo(0.5 * 0.50119 * 0.708, 4)
    })

    it('clamps the gain to attenuation only, at most -24 dB', () => {
        expect(clipVolume(0.6, 6, 'speech')).toBe(0.6)
        expect(clipVolume(1, -60, 'speech')).toBeCloseTo(10 ** (-24 / 20), 6)
        expect(clipGainDb(3)).toBe(0)
        expect(clipGainDb(-30)).toBe(-24)
        expect(clipGainDb(Number.POSITIVE_INFINITY)).toBeNull()
    })

    it('is silent when muted (user volume 0) and stays within 0..1', () => {
        expect(clipVolume(0, -3, 'thought')).toBe(0)
        expect(clipVolume(0, undefined, 'speech')).toBe(0)
        expect(clipVolume(2, -1, 'speech')).toBeLessThanOrEqual(1)
        expect(clipVolume(-1, -1, 'speech')).toBe(0)
        expect(clipVolume(Number.NaN, undefined)).toBe(1)
    })
})
