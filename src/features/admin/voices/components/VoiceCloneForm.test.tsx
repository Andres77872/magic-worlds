import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceCloneForm } from './VoiceCloneForm'

const uploadAdminVoiceCloneSample = vi.fn()
const cloneAdminVoice = vi.fn()

vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        uploadAdminVoiceCloneSample: (...args: unknown[]) => uploadAdminVoiceCloneSample(...args),
        cloneAdminVoice: (...args: unknown[]) => cloneAdminVoice(...args),
    },
    isProtectedMediaUrl: () => false,
}))

// jsdom never fires loadedmetadata, so stub the duration probe to a valid value.
vi.mock('../hexAudio', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../hexAudio')>()
    return { ...actual, readAudioDuration: vi.fn().mockResolvedValue(30) }
})

function selectFile(file: File) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
}

describe('VoiceCloneForm', () => {
    const props = () => ({
        onCreated: vi.fn(),
        notify: vi.fn(),
        setError: vi.fn(),
        onSendToLab: vi.fn(),
    })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:clip'),
            revokeObjectURL: vi.fn(),
        })
        uploadAdminVoiceCloneSample.mockResolvedValue({
            file_id: 123,
            purpose: 'voice_clone',
            base_resp: { status_code: 0, status_msg: 'success' },
        })
        cloneAdminVoice.mockResolvedValue({
            voice_id: 'MyClonedVoice01',
            voice_type: 'voice_cloning',
            demo_audio_url: null,
            input_sensitive: false,
            base_resp: { status_code: 0, status_msg: 'success' },
        })
    })

    it('rejects a non-audio file before uploading', () => {
        render(<VoiceCloneForm {...props()} />)

        selectFile(new File(['hello'], 'notes.txt', { type: 'text/plain' }))

        expect(screen.getByText('Use an MP3, M4A, or WAV file.')).toBeInTheDocument()
        expect(uploadAdminVoiceCloneSample).not.toHaveBeenCalled()
    })

    it('uploads the sample, clones, then sends the new voice to the lab', async () => {
        const handlers = props()
        render(<VoiceCloneForm {...handlers} />)

        selectFile(new File([new Uint8Array(2048)], 'sample.wav', { type: 'audio/wav' }))

        await waitFor(() => expect(uploadAdminVoiceCloneSample).toHaveBeenCalledTimes(1))
        expect(uploadAdminVoiceCloneSample).toHaveBeenCalledWith(expect.any(File), 'voice_clone')

        fireEvent.change(screen.getByLabelText('Voice ID'), { target: { value: 'MyClonedVoice01' } })

        const clone = await screen.findByRole('button', { name: 'Clone voice' })
        await waitFor(() => expect(clone).toBeEnabled())
        fireEvent.click(clone)

        await waitFor(() => {
            expect(cloneAdminVoice).toHaveBeenCalledWith({
                file_id: 123,
                voice_id: 'MyClonedVoice01',
                need_noise_reduction: true,
                need_volume_normalization: true,
            })
        })

        expect(await screen.findByText(/appear in the library only after/i)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Send to lab' }))
        expect(handlers.onSendToLab).toHaveBeenCalledWith('MyClonedVoice01')
    })

    it('keeps the clone button disabled until a sample and valid voice ID are present', async () => {
        render(<VoiceCloneForm {...props()} />)

        const clone = screen.getByRole('button', { name: 'Clone voice' })
        expect(clone).toBeDisabled()

        // Valid voice id alone is not enough without an uploaded sample.
        fireEvent.change(screen.getByLabelText('Voice ID'), { target: { value: 'MyClonedVoice01' } })
        expect(clone).toBeDisabled()
    })
})
