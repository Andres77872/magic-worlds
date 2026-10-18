import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/app/i18n'
import type { Character } from '@/shared'
import { PersonaPickerDialog } from './PersonaPickerDialog'

const ai = { id: 'ai', name: 'Lyra', role: 'character', stats: {} } as Character
const persona = { id: 'p1', name: 'Aria', role: 'persona', stats: {} } as Character
const preferred = { ...persona, id: 'p2', name: 'Sera', is_default_persona: true }

function props(characters: Character[]) {
    return { open: true, title: 'Choose persona', actionLabel: 'Start', characters,
        onClose: vi.fn(), onConfirm: vi.fn(), onCreateCharacter: vi.fn() }
}

describe('PersonaPickerDialog session eligibility', () => {
    it('offers only personas and preserves the workspace default', () => {
        const callbacks = props([ai, persona, preferred])
        render(<PersonaPickerDialog {...callbacks} />)
        expect(screen.queryByRole('button', { name: /Lyra/ })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Sera/ })).toHaveAttribute('aria-pressed', 'true')
        fireEvent.click(screen.getByRole('button', { name: 'Start' }))
        expect(callbacks.onConfirm).toHaveBeenCalledExactlyOnceWith(preferred)
    })

    it.each([[[]], [[ai]], [[{ ...ai, role: undefined }]]])('offers persona creation instead of an invalid fallback: %j', (characters) => {
        const callbacks = props(characters)
        render(<PersonaPickerDialog {...callbacks} />)
        expect(screen.getByText('No persona cards available')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Create persona' }))
        expect(callbacks.onCreateCharacter).toHaveBeenCalledOnce()
        expect(callbacks.onConfirm).not.toHaveBeenCalled()
    })

    it('invalidates a selected card when its role changes while the picker is open', async () => {
        const callbacks = props([persona])
        const view = render(<PersonaPickerDialog {...callbacks} />)
        view.rerender(<PersonaPickerDialog {...callbacks} characters={[{ ...persona, role: 'character' }]} />)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled())
        expect(callbacks.onConfirm).not.toHaveBeenCalled()
    })

    it('renders the no-persona recovery action in Spanish', () => {
        render(<I18nextProvider i18n={i18n.cloneInstance({ lng: 'es' })}><PersonaPickerDialog {...props([ai])} /></I18nextProvider>)
        expect(screen.getByRole('button', { name: 'Crear persona' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
    })
})
