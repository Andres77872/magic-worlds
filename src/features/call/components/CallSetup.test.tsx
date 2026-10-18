import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CharacterVoiceV2, StoredCharacterVoice } from '@/shared/types'
import { CallSetup } from './CallSetup'

// The picker is its own suite: here it only hands back a choice.
const picker = vi.hoisted(() => ({ props: null as null | { open: boolean; worksInCalls?: boolean; onSelect: (voice: StoredCharacterVoice | null) => void } }))
vi.mock('@/features/voices/components/VoicePickerDialog', () => ({
    VoicePickerDialog: (props: NonNullable<typeof picker.props>) => {
        picker.props = props
        return props.open ? <div role="dialog" aria-label="Voice picker" /> : null
    },
}))

function voice(key: string, name: string): CharacterVoiceV2 {
    return { schema_version: 2, provider: 'elevenlabs', voice_key: key, voice_name: name, settings: null, emotion: null, language_code: null, preset_id: null, preset_name: null }
}

const CHARACTER = voice('vk_character', 'Eldrin')
const PICK = voice('vk_pick', 'Rowan')

describe('CallSetup', () => {
    it('shows the chat’s voice when nothing was picked for calls', () => {
        render(<CallSetup name="Lyra" characterVoice={CHARACTER} pick={null} onPick={vi.fn()} />)

        expect(screen.getByTestId('call-setup-voice')).toHaveTextContent('Eldrin')
        expect(screen.queryByText('Calls only')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Use the character’s voice' })).not.toBeInTheDocument()
    })

    it('names the default call voice for a character without one', () => {
        render(<CallSetup name="Lyra" characterVoice={null} pick={null} onPick={vi.fn()} />)
        expect(screen.getByTestId('call-setup-voice')).toHaveTextContent('Default call voice')
    })

    it('marks a pick as calls only, and goes back to the character’s voice', () => {
        const onPick = vi.fn()
        render(<CallSetup name="Lyra" characterVoice={CHARACTER} pick={PICK} onPick={onPick} />)

        expect(screen.getByTestId('call-setup-voice')).toHaveTextContent('Rowan')
        expect(screen.getByText('Calls only')).toBeInTheDocument()
        expect(screen.getByText(/Used for your calls with Lyra/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Use the character’s voice' }))
        expect(onPick).toHaveBeenCalledWith(null)
    })

    it('opens a picker of call-ready voices and keeps a different voice as the pick', () => {
        const onPick = vi.fn()
        render(<CallSetup name="Lyra" characterVoice={CHARACTER} pick={null} onPick={onPick} />)

        fireEvent.click(screen.getByRole('button', { name: 'Change voice' }))
        expect(screen.getByRole('dialog', { name: 'Voice picker' })).toBeInTheDocument()
        expect(picker.props?.worksInCalls).toBe(true)

        picker.props!.onSelect(PICK)
        expect(onPick).toHaveBeenLastCalledWith(PICK)
    })

    it('treats picking the character’s own voice, or no voice, as no pick', () => {
        const onPick = vi.fn()
        render(<CallSetup name="Lyra" characterVoice={CHARACTER} pick={PICK} onPick={onPick} />)

        picker.props!.onSelect(voice('vk_character', 'Eldrin'))
        expect(onPick).toHaveBeenLastCalledWith(null)
        picker.props!.onSelect(null)
        expect(onPick).toHaveBeenLastCalledWith(null)
    })

    it('says when the voice cannot take calls and leads with changing it', () => {
        render(<CallSetup name="Lyra" characterVoice={CHARACTER} pick={null} onPick={vi.fn()} voiceUnavailable />)

        expect(screen.getByTestId('call-setup-voice-unavailable')).toHaveTextContent(/can’t take calls right now/)
        expect(screen.getByRole('button', { name: 'Change voice' })).toBeEnabled()
    })

    it('hosts the conversation-model control and disables its actions while starting', () => {
        render(
            <CallSetup name="Lyra" characterVoice={CHARACTER} pick={PICK} onPick={vi.fn()} disabled
                model={<span data-testid="model-control">Haiku</span>} />,
        )

        const setup = screen.getByTestId('call-setup')
        expect(within(setup).getByText('Conversation model')).toBeInTheDocument()
        expect(within(setup).getByTestId('model-control')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Change voice' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Use the character’s voice' })).toBeDisabled()
    })
})
