import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VoicePickerDialog } from './VoicePickerDialog'

const listVoicePresets = vi.fn()
const listSystemVoices = vi.fn()
const previewVoice = vi.fn()

vi.mock('@/app/hooks/usePlaylist', () => ({ usePlaylist: () => ({}) }))
vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listVoicePresets: (...a: unknown[]) => listVoicePresets(...a),
        listSystemVoices: (...a: unknown[]) => listSystemVoices(...a),
        previewVoice: (...a: unknown[]) => previewVoice(...a),
    },
    isProtectedMediaUrl: () => false,
}))

const preset = {
    preset_id: 'global-child-girl',
    name: 'Child girl',
    base_voice_id: 'English_radiant_girl',
    base_voice_name: 'Radiant girl',
    speed: 1.05,
    volume: 1,
    pitch: 5,
    emotion: 'happy',
    language_boost: 'English',
    is_global: true,
}

const systemVoice = {
    voice_id: 'English_expressive_narrator',
    voice_type: 'system',
    voice_name: 'Expressive narrator',
    description: ['Warm narrator.'],
    created_time: '1970-01-01',
    deletable: false,
}

describe('VoicePickerDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
        listVoicePresets.mockResolvedValue([preset])
        listSystemVoices.mockResolvedValue({
            voice_type: 'system',
            groups: { system: [systemVoice], voice_cloning: [], voice_generation: [] },
            base_resp: { status_code: 0, status_msg: 'ok' },
        })
    })

    it('selects a preset and emits its denormalized recipe', async () => {
        const onSelect = vi.fn()
        render(<VoicePickerDialog open onSelect={onSelect} onClose={vi.fn()} />)

        fireEvent.click(await screen.findByRole('button', { name: 'Use' }))

        expect(onSelect).toHaveBeenCalledWith({
            voice_id: 'English_radiant_girl',
            speed: 1.05,
            vol: 1,
            pitch: 5,
            emotion: 'happy',
            language_boost: 'English',
            preset_id: 'global-child-girl',
            preset_name: 'Child girl',
        })
    })

    it('selects a raw system voice (no recipe)', async () => {
        const onSelect = vi.fn()
        render(<VoicePickerDialog open onSelect={onSelect} onClose={vi.fn()} />)

        fireEvent.click(await screen.findByRole('button', { name: 'System voices' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Select' }))

        expect(onSelect).toHaveBeenCalledWith({ voice_id: 'English_expressive_narrator' })
    })

    it('clears the voice', async () => {
        const onSelect = vi.fn()
        render(<VoicePickerDialog open onSelect={onSelect} onClose={vi.fn()} />)
        await screen.findByText('Child girl')
        fireEvent.click(screen.getByRole('button', { name: 'Clear voice' }))
        expect(onSelect).toHaveBeenCalledWith(null)
    })

    it('surfaces the current preset voice (summary + selected row) on open', async () => {
        render(
            <VoicePickerDialog
                open
                currentVoice={{ voice_id: 'English_radiant_girl', preset_id: 'global-child-girl', preset_name: 'Child girl' }}
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />,
        )

        expect(await screen.findByText('Currently using')).toBeInTheDocument()
        // The matching preset's action button reads "Selected" instead of "Use".
        expect(await screen.findByRole('button', { name: 'Selected' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use' })).not.toBeInTheDocument()
    })

    it('auto-opens the System voices tab when the current voice is a system voice', async () => {
        render(
            <VoicePickerDialog
                open
                currentVoice={{ voice_id: 'English_expressive_narrator' }}
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />,
        )

        // No tab click — the system voice row is highlighted as selected directly.
        expect(await screen.findByRole('button', { name: 'Selected' })).toBeInTheDocument()
        expect(screen.getByText('Expressive narrator')).toBeInTheDocument()
    })

    it('previews a preset', async () => {
        previewVoice.mockResolvedValue({ voice_id: 'English_radiant_girl', audio_hex: '00', content_type: 'audio/mpeg', base_resp: { status_code: 0, status_msg: 'ok' } })
        render(<VoicePickerDialog open onSelect={vi.fn()} onClose={vi.fn()} />)

        fireEvent.click(await screen.findByRole('button', { name: 'Preview' }))

        await waitFor(() =>
            expect(previewVoice).toHaveBeenCalledWith(
                expect.objectContaining({ voice_id: 'English_radiant_girl', speed: 1.05, vol: 1, pitch: 5, emotion: 'happy' }),
            ),
        )
    })
})
