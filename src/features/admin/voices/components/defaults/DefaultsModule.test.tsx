import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { readyVoice, replacementVoice } from '../../fixtures'
import { consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { DefaultsModule } from './DefaultsModule'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

function pick(section: HTMLElement, combobox: string, option: RegExp) {
    fireEvent.click(within(section).getByRole('combobox', { name: combobox }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}

describe('DefaultsModule (AC-R4)', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
    })

    it('marks every required row that is not set as Missing', async () => {
        renderInConsole(<DefaultsModule />, 'defaults')
        const english = await screen.findByRole('region', { name: 'English (en)' })
        const spanish = screen.getByRole('region', { name: 'Spanish (es)' })
        // English has a narrator but only one fallback voice.
        expect(within(english).getAllByText('Missing')).toHaveLength(1)
        expect(within(english).getByText('At least 4 fallback voices are required.')).toBeInTheDocument()
        // Spanish has neither.
        expect(within(spanish).getAllByText('Missing')).toHaveLength(2)
        expect(within(spanish).getByText('A narrator is required.')).toBeInTheDocument()
        // Light languages need a narrator only.
        const french = screen.getByRole('region', { name: 'French (fr)' })
        expect(within(french).getAllByText('Missing')).toHaveLength(1)
        expect(within(french).queryByText('Character fallback pool')).not.toBeInTheDocument()
        expect(screen.getByText(readyVoice.voice_key)).toBeInTheDocument()
    })

    it('blocks saving a voice that fails a readiness check and names the failing check', async () => {
        renderInConsole(<DefaultsModule />, 'defaults')
        const spanish = await screen.findByRole('region', { name: 'Spanish (es)' })
        pick(spanish, 'Narrator', /Eldrin/)
        fireEvent.click(within(spanish).getByRole('button', { name: 'Save Narrator' }))
        expect(await within(spanish).findByRole('alert')).toHaveTextContent('Eldrin cannot be saved: Active')
        expect(mock().putVoiceDefaults).not.toHaveBeenCalled()

        // A voice ready in English is still not ready in Spanish.
        pick(spanish, 'Narrator', /Maren/)
        fireEvent.click(within(spanish).getByRole('button', { name: 'Save Narrator' }))
        expect(await within(spanish).findByRole('alert')).toHaveTextContent('Maren cannot be saved: Accepted on v4 in Spanish')
        expect(mock().putVoiceDefaults).not.toHaveBeenCalled()
    })

    it('saves a ready narrator', async () => {
        mock().putVoiceDefaults.mockResolvedValue({
            items: [{ role: 'narrator', language: 'en', rank: 1, voice_key: replacementVoice.voice_key, updated_by_user_id: 1, updated_at: '2026-10-12T09:00:00Z' }],
        })
        renderInConsole(<DefaultsModule />, 'defaults')
        const english = await screen.findByRole('region', { name: 'English (en)' })
        pick(english, 'Narrator', /Ysolde/)
        expect(within(english).getByRole('list', { name: 'Readiness' })).toBeInTheDocument()
        fireEvent.click(within(english).getByRole('button', { name: 'Save Narrator' }))
        await waitFor(() => expect(mock().putVoiceDefaults).toHaveBeenCalledWith('narrator', 'en', [replacementVoice.voice_key]))
        expect(await screen.findByText('Defaults saved')).toBeInTheDocument()
    })

    it('orders the fallback pool and warns when it does not mix genders', async () => {
        mock().putVoiceDefaults.mockResolvedValue({ items: [] })
        renderInConsole(<DefaultsModule />, 'defaults')
        const english = await screen.findByRole('region', { name: 'English (en)' })
        pick(english, 'Add a fallback voice', /Maren/)
        fireEvent.click(within(english).getByRole('button', { name: 'Add' }))
        expect(within(english).getByText('The fallback pool should mix genders.')).toBeInTheDocument()
        fireEvent.click(within(english).getByRole('button', { name: 'Move Maren up' }))
        fireEvent.click(within(english).getByRole('button', { name: 'Save Character fallback pool' }))
        await waitFor(() =>
            expect(mock().putVoiceDefaults).toHaveBeenCalledWith('character_fallback', 'en', [readyVoice.voice_key, replacementVoice.voice_key]),
        )
    })
})
