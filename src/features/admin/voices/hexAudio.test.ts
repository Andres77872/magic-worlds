import { describe, expect, it } from 'vitest'
import { hexToBlob } from './hexAudio'

describe('hexToBlob', () => {
    it('decodes valid hex into a typed Blob', () => {
        const blob = hexToBlob('00ff10', 'audio/wav')
        expect(blob).not.toBeNull()
        expect(blob?.type).toBe('audio/wav')
        expect(blob?.size).toBe(3)
    })

    it('defaults to audio/mpeg', () => {
        expect(hexToBlob('00')?.type).toBe('audio/mpeg')
    })

    it.each(['', 'abc', 'zz', null, undefined])('rejects %s', (value) => {
        expect(hexToBlob(value)).toBeNull()
    })
})
