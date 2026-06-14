import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminVoicesPage } from './AdminVoicesPage'

const mockUseAuth = vi.fn()
const listAdminVoices = vi.fn()
const designAdminVoice = vi.fn()
const deleteAdminVoice = vi.fn()
const testAdminVoice = vi.fn()
const uploadAdminVoiceCloneSample = vi.fn()
const cloneAdminVoice = vi.fn()

vi.mock('@/app/hooks', () => ({
    useAuth: () => mockUseAuth(),
}))

// VoiceClipPlayer pulls the audio barrel, which re-exports the playlist dock;
// its hook is never called here, but mock the deep import per the known gotcha.
vi.mock('@/app/hooks/usePlaylist', () => ({
    usePlaylist: () => ({}),
}))

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listAdminVoices: (...args: unknown[]) => listAdminVoices(...args),
        designAdminVoice: (...args: unknown[]) => designAdminVoice(...args),
        deleteAdminVoice: (...args: unknown[]) => deleteAdminVoice(...args),
        testAdminVoice: (...args: unknown[]) => testAdminVoice(...args),
        uploadAdminVoiceCloneSample: (...args: unknown[]) => uploadAdminVoiceCloneSample(...args),
        cloneAdminVoice: (...args: unknown[]) => cloneAdminVoice(...args),
    },
    isProtectedMediaUrl: () => false,
}))

const rootUser = {
    user_hash: 'usr-root',
    username: 'root',
    user_type: 'root',
    created_at: null,
    updated_at: null,
}

const consumerUser = { ...rootUser, user_hash: 'usr-consumer', username: 'lyra', user_type: 'consumer' }

const voiceGroups = {
    system: [
        {
            voice_id: 'English_expressive_narrator',
            voice_type: 'system',
            voice_name: 'Expressive narrator',
            description: ['Warm narrator voice.'],
            created_time: '1970-01-01',
            deletable: false,
        },
    ],
    voice_cloning: [],
    voice_generation: [
        {
            voice_id: 'ttv-voice-existing',
            voice_type: 'voice_generation',
            voice_name: null,
            description: ['A designed voice.'],
            created_time: '2026-06-13',
            deletable: true,
        },
    ],
}

describe('AdminVoicesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:voice-preview'),
            revokeObjectURL: vi.fn(),
        })
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: rootUser, openLoginModal: vi.fn() })
        listAdminVoices.mockResolvedValue({
            voice_type: 'all',
            groups: voiceGroups,
            base_resp: { status_code: 0, status_msg: 'success' },
        })
        designAdminVoice.mockResolvedValue({
            voice_id: 'ttv-voice-created',
            trial_audio: '00',
            base_resp: { status_code: 0, status_msg: 'success' },
        })
        deleteAdminVoice.mockResolvedValue({
            voice_id: 'ttv-voice-existing',
            voice_type: 'voice_generation',
            created_time: '2026-06-13',
            base_resp: { status_code: 0, status_msg: 'success' },
        })
        testAdminVoice.mockResolvedValue({
            voice_id: 'ttv-voice-existing',
            audio_hex: '00',
            content_type: 'audio/mpeg',
            file_size_bytes: 1,
            duration_ms: 2100,
            sample_rate: 32000,
            bitrate: 128000,
            usage_characters: 54,
            base_resp: { status_code: 0, status_msg: 'success' },
        })
    })

    it('asks signed-out users to log in', () => {
        const openLoginModal = vi.fn()
        mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, openLoginModal })

        render(<AdminVoicesPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
        expect(openLoginModal).toHaveBeenCalledTimes(1)
        expect(listAdminVoices).not.toHaveBeenCalled()
    })

    it('denies authenticated non-root users', () => {
        mockUseAuth.mockReturnValue({ isAuthenticated: true, user: consumerUser, openLoginModal: vi.fn() })

        render(<AdminVoicesPage />)

        expect(screen.getByText('Root access required')).toBeInTheDocument()
        expect(screen.getByText(/limited to root users/i)).toBeInTheDocument()
        expect(listAdminVoices).not.toHaveBeenCalled()
    })

    it('designs a voice, previews it, lists, and deletes designed voices', async () => {
        const { container } = render(<AdminVoicesPage />)

        const designedSection = (await screen.findByRole('heading', { name: 'Designed voices' })).closest('section')!
        expect(within(designedSection).getAllByText('ttv-voice-existing').length).toBeGreaterThan(0)
        expect(screen.getByText('Expressive narrator')).toBeInTheDocument()
        expect(screen.getByText('Protected')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Design voice' }))

        await waitFor(() => {
            expect(designAdminVoice).toHaveBeenCalledWith({
                prompt: expect.stringContaining('fantasy narrator'),
                preview_text: expect.stringContaining('hidden door opens'),
            })
        })
        // The new id shows in both the result card and the success toast.
        expect((await screen.findAllByText('ttv-voice-created')).length).toBeGreaterThan(0)
        expect(screen.getByRole('button', { name: 'Play designed preview' })).toBeInTheDocument()
        expect(container.querySelector('audio')?.getAttribute('src')).toBe('blob:voice-preview')

        fireEvent.click(within(designedSection).getByRole('button', { name: 'Delete' }))
        const dialog = screen.getByRole('dialog', { name: 'Delete voice' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            expect(deleteAdminVoice).toHaveBeenCalledWith('voice_generation', 'ttv-voice-existing')
        })
        expect(within(designedSection).queryByText('A designed voice.')).not.toBeInTheDocument()
    })

    it('sends a library voice to the lab and tests it with default controls', async () => {
        render(<AdminVoicesPage />)

        const designedSection = (await screen.findByRole('heading', { name: 'Designed voices' })).closest('section')!
        fireEvent.click(within(designedSection).getByRole('button', { name: 'Test' }))

        expect(screen.getByLabelText('Voice ID')).toHaveValue('ttv-voice-existing')

        const testText = 'The lock turns once.<#0.4#> (sighs) It has been waiting.'
        fireEvent.change(screen.getByLabelText('Content input'), { target: { value: testText } })
        fireEvent.click(screen.getByRole('button', { name: 'Test voice' }))

        await waitFor(() => {
            // Untouched controls are omitted; only voice_id + text are sent.
            expect(testAdminVoice).toHaveBeenCalledWith({ voice_id: 'ttv-voice-existing', text: testText })
        })
        expect(screen.getByRole('button', { name: 'Play voice test' })).toBeInTheDocument()
    })

    it('blocks over-limit lab content before calling the API', async () => {
        render(<AdminVoicesPage />)

        await screen.findByRole('heading', { name: 'Designed voices' })
        fireEvent.change(screen.getByLabelText('Voice ID'), { target: { value: 'ttv-voice-existing' } })
        fireEvent.change(screen.getByLabelText('Content input'), { target: { value: 'x'.repeat(1001) } })

        expect(screen.getByText('Test content must be 1000 characters or fewer.')).toBeInTheDocument()
        const submit = screen.getByRole('button', { name: 'Test voice' })
        expect(submit).toBeDisabled()
        fireEvent.click(submit)
        expect(testAdminVoice).not.toHaveBeenCalled()
    })

    it('opens the MiniMax reference drawer', async () => {
        render(<AdminVoicesPage />)

        await screen.findByRole('heading', { name: 'Designed voices' })
        fireEvent.click(screen.getByRole('button', { name: 'Reference' }))

        expect(await screen.findByText('Voice reference')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cloning' })).toBeInTheDocument()
    })
})
