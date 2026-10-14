import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LabResultCard, type LabResult } from './LabResultCard'

const download = vi.hoisted(() => ({ downloadBlob: vi.fn() }))
vi.mock('@/utils/download', async (importOriginal) => ({ ...(await importOriginal<object>()), downloadBlob: download.downloadBlob }))

const result = (overrides: Partial<LabResult>): LabResult => ({
    id: 1,
    title: 'Maren, v4',
    blob: new Blob([new Uint8Array([0xff, 0xfb])], { type: 'audio/mpeg' }),
    contentType: 'audio/mpeg',
    outputFormat: 'mp3_44100_128',
    requestId: null,
    characterCost: null,
    ...overrides,
})

describe('LabResultCard audio formats (R1-FE-06)', () => {
    let created: Blob[]

    beforeEach(() => {
        created = []
        const original = URL.createObjectURL.bind(URL)
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
            created.push(blob as Blob)
            return original(blob as Blob)
        })
        download.downloadBlob.mockReset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const card = (value: LabResult) => render(<LabResultCard result={value} pinned={false} canPin onTogglePin={vi.fn()} />)

    it('plays MP3 as served and downloads it as .mp3', () => {
        const value = result({})
        card(value)
        expect(screen.getByTestId('voice-clip-player')).toBeInTheDocument()
        expect(created).toEqual([value.blob])
        fireEvent.click(screen.getByRole('button', { name: 'Download' }))
        expect(download.downloadBlob).toHaveBeenCalledWith(value.blob, 'Maren,-v4.mp3')
    })

    it('plays WAV as served and downloads it as .wav', () => {
        const value = result({ blob: new Blob([new Uint8Array([0x52])], { type: 'audio/wav' }), contentType: 'audio/wav', outputFormat: 'wav_44100' })
        card(value)
        expect(created).toEqual([value.blob])
        fireEvent.click(screen.getByRole('button', { name: 'Download' }))
        expect(download.downloadBlob).toHaveBeenCalledWith(value.blob, 'Maren,-v4.wav')
    })

    it('plays raw PCM through a WAV header and downloads the raw bytes as .pcm', async () => {
        const value = result({ blob: new Blob([new Uint8Array([0, 1, 0, 1])], { type: 'audio/pcm' }), contentType: 'audio/pcm;rate=24000', outputFormat: 'pcm_24000' })
        card(value)
        expect(await screen.findByTestId('voice-clip-player')).toBeInTheDocument()
        await waitFor(() => expect(created).toHaveLength(1))
        expect(created[0].type).toBe('audio/wav')
        expect(created[0].size).toBe(44 + 4)
        fireEvent.click(screen.getByRole('button', { name: 'Download' }))
        expect(download.downloadBlob).toHaveBeenCalledWith(value.blob, 'Maren,-v4.pcm')
    })
})
