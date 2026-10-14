import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleAudioPlayer } from './ConsoleAudioPlayer'

const api = vi.hoisted(() => ({ fetchProtectedMediaBlob: vi.fn() }))
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const download = vi.hoisted(() => ({ downloadBlob: vi.fn() }))
vi.mock('@/utils/download', async (importOriginal) => ({ ...(await importOriginal<object>()), downloadBlob: download.downloadBlob }))

describe('ConsoleAudioPlayer (R1-FE-06)', () => {
    let created: Blob[]

    beforeEach(() => {
        created = []
        const original = URL.createObjectURL.bind(URL)
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
            created.push(blob as Blob)
            return original(blob as Blob)
        })
        api.fetchProtectedMediaBlob.mockReset()
        download.downloadBlob.mockReset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('plays an MP3 sample as served, with no download unless asked (R0 unchanged)', async () => {
        const mp3 = new Blob([new Uint8Array([0xff])], { type: 'audio/mpeg' })
        api.fetchProtectedMediaBlob.mockResolvedValue(mp3)
        render(<ConsoleAudioPlayer path="/admin/voices/samples/a.mp3" title="Maren" />)
        expect(await screen.findByTestId('voice-clip-player')).toBeInTheDocument()
        expect(api.fetchProtectedMediaBlob).toHaveBeenCalledWith('/admin/voices/samples/a.mp3', 'audio/mpeg')
        expect(created).toEqual([mp3])
        expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    })

    it('plays a raw PCM render through a WAV header and downloads it as .pcm', async () => {
        const pcm = new Blob([new Uint8Array([0, 1, 0, 1, 0, 1])], { type: 'audio/pcm' })
        api.fetchProtectedMediaBlob.mockResolvedValue(pcm)
        render(<ConsoleAudioPlayer path="/admin/voices/renders/r.pcm" title="Render" downloadName="Maren render" />)
        expect(await screen.findByTestId('voice-clip-player')).toBeInTheDocument()
        await waitFor(() => expect(created).toHaveLength(1))
        expect(created[0].type).toBe('audio/wav')
        fireEvent.click(screen.getByRole('button', { name: 'Download' }))
        expect(download.downloadBlob).toHaveBeenCalledWith(pcm, 'Maren-render.pcm')
    })

    it('downloads a WAV render as .wav', async () => {
        const wav = new Blob([new Uint8Array([0x52])], { type: 'audio/wav' })
        api.fetchProtectedMediaBlob.mockResolvedValue(wav)
        render(<ConsoleAudioPlayer path="/admin/voices/renders/r.wav" title="Render" downloadName="Render" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
        expect(download.downloadBlob).toHaveBeenCalledWith(wav, 'Render.wav')
    })
})
