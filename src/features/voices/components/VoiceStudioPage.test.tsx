import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceStudioPage } from './VoiceStudioPage'

const mockUseAuth = vi.fn()
const listVoicePresets = vi.fn()
const listSystemVoices = vi.fn()
const deleteVoicePreset = vi.fn()
const previewVoice = vi.fn()
const createVoicePreset = vi.fn()
const updateVoicePreset = vi.fn()

vi.mock('@/app/hooks', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listVoicePresets: (...a: unknown[]) => listVoicePresets(...a),
        listSystemVoices: (...a: unknown[]) => listSystemVoices(...a),
        deleteVoicePreset: (...a: unknown[]) => deleteVoicePreset(...a),
        previewVoice: (...a: unknown[]) => previewVoice(...a),
        createVoicePreset: (...a: unknown[]) => createVoicePreset(...a),
        updateVoicePreset: (...a: unknown[]) => updateVoicePreset(...a),
    },
    isProtectedMediaUrl: () => false,
}))

const globalPreset = {
    preset_id: 'global-old-man',
    name: 'Old man',
    description: 'Deep, weathered elder.',
    base_voice_id: 'English_magnetic_voiced_man',
    base_voice_name: 'Magnetic-voiced man',
    speed: 0.9,
    volume: 1,
    pitch: -5,
    emotion: 'calm',
    language_boost: 'English',
    is_global: true,
}

const userPreset = {
    preset_id: 'user-1',
    name: 'My pirate',
    description: null,
    base_voice_id: 'English_radiant_girl',
    base_voice_name: 'Radiant girl',
    speed: 1.1,
    volume: 1,
    pitch: 2,
    emotion: null,
    language_boost: 'auto',
    is_global: false,
}

describe('VoiceStudioPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
        mockUseAuth.mockReturnValue({ isAuthenticated: true, openLoginModal: vi.fn() })
        listVoicePresets.mockResolvedValue([userPreset, globalPreset])
        listSystemVoices.mockResolvedValue({ voice_type: 'system', groups: { system: [], voice_cloning: [], voice_generation: [] }, base_resp: { status_code: 0, status_msg: 'ok' } })
        deleteVoicePreset.mockResolvedValue(undefined)
    })

    it('prompts sign-in when logged out', () => {
        const openLoginModal = vi.fn()
        mockUseAuth.mockReturnValue({ isAuthenticated: false, openLoginModal })
        render(<VoiceStudioPage />)
        expect(screen.getByText('Sign in to build voices')).toBeInTheDocument()
        expect(listVoicePresets).not.toHaveBeenCalled()
    })

    it('lists presets; globals are read-only (duplicate only), user presets editable', async () => {
        render(<VoiceStudioPage />)

        expect(await screen.findByText('My pirate')).toBeInTheDocument()
        expect(screen.getByText('Old man')).toBeInTheDocument()
        expect(screen.getByText('Default')).toBeInTheDocument()

        // Global: duplicate yes, edit/delete no.
        expect(screen.getByRole('button', { name: 'Duplicate Old man' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit Old man' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete Old man' })).not.toBeInTheDocument()

        // User: edit + delete present.
        expect(screen.getByRole('button', { name: 'Edit My pirate' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Delete My pirate' })).toBeInTheDocument()
    })

    it('deletes a user preset through the confirm dialog', async () => {
        render(<VoiceStudioPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'Delete My pirate' }))

        const dialog = screen.getByRole('dialog', { name: 'Delete preset' })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => expect(deleteVoicePreset).toHaveBeenCalledWith('user-1'))
        // The card is gone (the success toast still echoes the name briefly).
        await waitFor(() => expect(screen.queryByText('Radiant girl')).not.toBeInTheDocument())
    })

    it('opens the editor from New preset', async () => {
        render(<VoiceStudioPage />)
        await screen.findByText('My pirate')
        fireEvent.click(screen.getByRole('button', { name: 'New preset' }))
        expect(await screen.findByLabelText('Preset name')).toBeInTheDocument()
    })
})
