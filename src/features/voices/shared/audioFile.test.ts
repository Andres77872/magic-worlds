import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAudioDuration } from './audioFile'

/** The <audio> the probe creates, captured so a test can fire its media events. */
let probe: HTMLAudioElement | null = null
const createObjectURL = vi.fn(() => 'blob:probe')
const revokeObjectURL = vi.fn()

function fire(type: 'loadedmetadata' | 'error', duration?: number) {
    if (!probe) throw new Error('No probe was created.')
    if (duration !== undefined) Object.defineProperty(probe, 'duration', { configurable: true, value: duration })
    probe.dispatchEvent(new Event(type))
}

describe('readAudioDuration (R1-FE-06, 05 §2.2)', () => {
    beforeEach(() => {
        probe = null
        createObjectURL.mockClear()
        revokeObjectURL.mockClear()
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
        const create = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => {
            const element = create(tag, options)
            if (tag === 'audio') probe = element as HTMLAudioElement
            return element
        }) as typeof document.createElement)
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    const file = () => new File([new Uint8Array([1, 2, 3])], 'sample.mp3', { type: 'audio/mpeg' })

    it('resolves the duration from a metadata-only probe and revokes its URL', async () => {
        const pending = readAudioDuration(file())
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect(probe?.preload).toBe('metadata')
        expect(probe?.getAttribute('src')).toBe('blob:probe')
        fire('loadedmetadata', 12.5)
        await expect(pending).resolves.toBe(12.5)
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:probe')
        expect(probe?.hasAttribute('src')).toBe(false)
    })

    it.each([0, Number.NaN, Number.POSITIVE_INFINITY])('rejects an unusable duration (%s) and still revokes', async (duration) => {
        const pending = readAudioDuration(file())
        fire('loadedmetadata', duration)
        await expect(pending).rejects.toThrow('Could not read audio duration.')
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:probe')
    })

    it('rejects when the metadata cannot load and still revokes', async () => {
        const pending = readAudioDuration(file())
        fire('error')
        await expect(pending).rejects.toThrow('Could not read audio metadata.')
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:probe')
    })
})
