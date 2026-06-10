import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, safeFilename } from './download'

describe('safeFilename', () => {
    it('strips path separators and reserved characters', () => {
        expect(safeFilename('a/b\\c?d%e*f:g|h"i<j>k')).toBe('a-b-c-d-e-f-g-h-i-j-k')
    })

    it('collapses whitespace runs to single hyphens', () => {
        expect(safeFilename('Ember   Hymn \t of Cinders')).toBe('Ember-Hymn-of-Cinders')
    })

    it('trims leading/trailing dots', () => {
        expect(safeFilename('..sneaky.name..')).toBe('sneaky.name')
    })

    it('caps the length at 80 characters', () => {
        expect(safeFilename('x'.repeat(200))).toHaveLength(80)
    })

    it('falls back when nothing survives', () => {
        expect(safeFilename('///')).toBe('audio')
        expect(safeFilename('   ', 'theme')).toBe('theme')
    })
})

describe('downloadBlob', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    it('clicks a temporary anchor with the filename and revokes the object URL', () => {
        const createObjectURL = vi.fn(() => 'blob:mock-url')
        const revokeObjectURL = vi.fn()
        vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement,
        ) {
            // Capture attributes at click time — the anchor is removed right after.
            expect(this.getAttribute('download')).toBe('ember-hymn.mp3')
            expect(this.getAttribute('href')).toBe('blob:mock-url')
            expect(this.isConnected).toBe(true)
        })

        downloadBlob(new Blob(['x']), 'ember-hymn.mp3')

        expect(click).toHaveBeenCalledTimes(1)
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
        expect(document.querySelector('a[download]')).toBeNull()
    })
})
