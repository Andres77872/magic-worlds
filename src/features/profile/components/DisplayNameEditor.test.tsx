import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { DisplayNameEditor } from './DisplayNameEditor'

function profileWith(displayName: string | null): UserProfile {
    return {
        user_hash: 'usr-1',
        username: 'lyra',
        display_name: displayName,
        user_type: 'consumer',
        user_usage: 0,
        card_counts: { character: 0, world: 0, adventure_template: 0, item: 0 },
    }
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('DisplayNameEditor', () => {
    it('shows the effective name (display name, else username) in view mode', () => {
        const { rerender } = render(<DisplayNameEditor username="lyra" displayName="The Loremaster" />)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The Loremaster')

        rerender(<DisplayNameEditor username="lyra" displayName={null} />)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('lyra')
    })

    it('does not save on opening the editor (no phantom submit)', async () => {
        const spy = vi.spyOn(apiService, 'updateDisplayName')
        render(<DisplayNameEditor username="lyra" displayName="Aria" />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))

        const input = await screen.findByLabelText('Display name')
        expect(input).toHaveValue('Aria')
        // Save is disabled while unchanged, and nothing was sent by merely opening.
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
        expect(spy).not.toHaveBeenCalled()
    })

    it('trims input and bubbles the saved value', async () => {
        const spy = vi.spyOn(apiService, 'updateDisplayName').mockResolvedValue(profileWith('Aria'))
        const onUpdated = vi.fn()
        render(<DisplayNameEditor username="lyra" displayName={null} onUpdated={onUpdated} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))
        const input = await screen.findByLabelText('Display name')
        fireEvent.change(input, { target: { value: '  Aria  ' } })

        const save = screen.getByRole('button', { name: 'Save' })
        await waitFor(() => expect(save).toBeEnabled())
        fireEvent.click(save)

        await waitFor(() => expect(spy).toHaveBeenCalledWith('Aria'))
        await waitFor(() => expect(onUpdated).toHaveBeenCalledWith('Aria'))
        expect(await screen.findByText('Display name updated.')).toBeInTheDocument()
    })

    it('sends null when the field is cleared', async () => {
        const spy = vi.spyOn(apiService, 'updateDisplayName').mockResolvedValue(profileWith(null))
        render(<DisplayNameEditor username="lyra" displayName="Existing" />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))
        const input = await screen.findByLabelText('Display name')
        fireEvent.change(input, { target: { value: '   ' } })

        const save = screen.getByRole('button', { name: 'Save' })
        await waitFor(() => expect(save).toBeEnabled())
        fireEvent.click(save)

        await waitFor(() => expect(spy).toHaveBeenCalledWith(null))
    })

    it('shows an error toast when the save fails', async () => {
        vi.spyOn(apiService, 'updateDisplayName').mockRejectedValue(new Error('network'))
        render(<DisplayNameEditor username="lyra" displayName={null} />)

        fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }))
        const input = await screen.findByLabelText('Display name')
        fireEvent.change(input, { target: { value: 'New Name' } })

        const save = screen.getByRole('button', { name: 'Save' })
        await waitFor(() => expect(save).toBeEnabled())
        fireEvent.click(save)

        expect(await screen.findByText(/Couldn't update your display name/i)).toBeInTheDocument()
    })
})
