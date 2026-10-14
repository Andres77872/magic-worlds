import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { auditDesign, auditLimits, draftVoice, readyVoice } from '../../fixtures'
import { consoleApiMock, renderInConsole, type ConsoleApiMock } from '../../testUtils'
import { CreateModule } from './CreateModule'

const api = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('@/infrastructure/api', async (importOriginal) => ({ ...(await importOriginal<object>()), apiService: api }))
const mock = () => api as unknown as ConsoleApiMock

const CHANGE = 'Older and raspier, with a slower pace.'

function pick(scope: HTMLElement, combobox: string, option: RegExp) {
    fireEvent.click(within(scope).getByRole('combobox', { name: combobox }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}

async function chooseAndSave(name: string) {
    const previews = await screen.findByRole('list', { name: 'Previews' })
    expect(within(previews).getAllByRole('listitem')).toHaveLength(3)
    const choose = within(previews).getAllByRole('button', { name: 'Choose this voice' })
    fireEvent.click(choose[1])
    expect(within(previews).getByRole('button', { name: 'Chosen' })).toHaveAttribute('aria-pressed', 'true')
    const form = screen.getByRole('form', { name: 'Save the chosen voice' })
    expect(within(form).getByText('Saving uses 1 custom voice slot (48 of 660 in use).')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Voice name'), { target: { value: name } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save as draft' }))
}

describe('CreateModule', () => {
    beforeEach(() => {
        for (const key of Object.keys(api)) delete api[key]
        Object.assign(api, consoleApiMock())
        mock().designAdminVoice.mockResolvedValue(auditDesign)
        mock().remixAdminVoice.mockResolvedValue(auditDesign)
        mock().saveAdminDesign.mockResolvedValue({ ...draftVoice, voice_key: 'vk_saved', display_name: 'Saved voice' })
    })

    describe('Voice Design (AC-R7)', () => {
        it('enforces the description and text lengths and the no-sound-alike confirmation', async () => {
            renderInConsole(<CreateModule />, 'create')
            const form = screen.getByRole('form', { name: 'Voice Design' })
            fireEvent.change(within(form).getByLabelText('Voice description'), { target: { value: 'Too short' } })
            fireEvent.change(within(form).getByLabelText('Preview text'), { target: { value: 'Also too short.' } })
            fireEvent.click(within(form).getByRole('button', { name: 'Generate previews' }))
            expect(within(form).getAllByText('Use between 20 and 1000 characters.')).toHaveLength(1)
            expect(within(form).getByText('Use between 100 and 1000 characters.')).toBeInTheDocument()
            expect(within(form).getByRole('alert')).toHaveTextContent('Confirm this before generating.')
            expect(mock().designAdminVoice).not.toHaveBeenCalled()

            // Auto text lifts the text length rule.
            fireEvent.click(within(form).getByRole('switch', { name: 'Generate the preview text automatically' }))
            expect(within(form).queryByText('Use between 100 and 1000 characters.')).not.toBeInTheDocument()
        })

        it('generates three previews and saves the chosen one with the unchosen ids, in this session', async () => {
            renderInConsole(<CreateModule />, 'create')
            const form = screen.getByRole('form', { name: 'Voice Design' })
            fireEvent.click(within(form).getByRole('checkbox', { name: 'This prompt does not describe or imitate a real person.' }))
            fireEvent.click(within(form).getByRole('button', { name: 'Generate previews' }))
            await waitFor(() =>
                expect(mock().designAdminVoice).toHaveBeenCalledWith(
                    expect.objectContaining({ auto_generate_text: false, guidance_scale: 5, seed: null, quality: null, should_enhance: false }),
                    expect.any(AbortSignal),
                ),
            )
            expect(await screen.findByText(/Save in this session/)).toBeInTheDocument()
            expect(await screen.findByRole('button', { name: 'Play Preview 1, English' })).toBeInTheDocument()

            await chooseAndSave('Saltmarsh')
            await waitFor(() =>
                expect(mock().saveAdminDesign).toHaveBeenCalledWith({
                    generated_voice_id: 'gen_2',
                    voice_name: 'Saltmarsh',
                    voice_description: expect.stringContaining('fantasy narrator'),
                    labels: { language: 'en', accent: null, gender: null, age: null },
                    played_not_selected_voice_ids: ['gen_1', 'gen_3'],
                }),
            )
            // The session is consumed: previews are gone, the saved draft can go to acceptance.
            expect(await screen.findByRole('button', { name: 'Send to acceptance' })).toBeInTheDocument()
            expect(screen.queryByRole('list', { name: 'Previews' })).not.toBeInTheDocument()
        })

        it('sends the advanced options the BFF forwards: loudness, guidance, quality and enhance', async () => {
            renderInConsole(<CreateModule />, 'create')
            const form = screen.getByRole('form', { name: 'Voice Design' })
            fireEvent.click(within(form).getByRole('button', { name: 'Advanced options' }))
            fireEvent.click(within(form).getByRole('switch', { name: 'Set quality' }))
            fireEvent.click(within(form).getByRole('switch', { name: 'Enhance the description' }))
            fireEvent.click(within(form).getByRole('checkbox', { name: 'This prompt does not describe or imitate a real person.' }))
            fireEvent.click(within(form).getByRole('button', { name: 'Generate previews' }))
            await waitFor(() =>
                expect(mock().designAdminVoice).toHaveBeenCalledWith(
                    expect.objectContaining({ loudness: 0.5, guidance_scale: 5, quality: 0.9, should_enhance: true }),
                    expect.any(AbortSignal),
                ),
            )
        })

        it('states the slot cost without counts when the provider did not report them', async () => {
            mock().getVoiceLimits.mockResolvedValue({ ...auditLimits, subscription: { ...auditLimits.subscription!, voice_limit: null } })
            renderInConsole(<CreateModule />, 'create')
            const form = screen.getByRole('form', { name: 'Voice Design' })
            fireEvent.click(within(form).getByRole('checkbox', { name: 'This prompt does not describe or imitate a real person.' }))
            fireEvent.click(within(form).getByRole('button', { name: 'Generate previews' }))
            const previews = await screen.findByRole('list', { name: 'Previews' })
            fireEvent.click(within(previews).getAllByRole('button', { name: 'Choose this voice' })[0])

            const save = screen.getByRole('form', { name: 'Save the chosen voice' })
            await waitFor(() => expect(mock().getVoiceLimits).toHaveBeenCalled())
            expect(within(save).getByText('Saving uses 1 custom voice slot.')).toBeInTheDocument()
            expect(within(save).queryByText(/in use/)).not.toBeInTheDocument()
        })
    })

    describe('Remix (AC-R8)', () => {
        async function openRemix() {
            renderInConsole(<CreateModule />, 'create')
            fireEvent.click(screen.getByRole('tab', { name: 'Remix' }))
            return screen.findByRole('form', { name: 'Remix' })
        }

        it('shows why a Library voice cannot be remixed', async () => {
            const form = await openRemix()
            await waitFor(() => expect(mock().listAdminCatalog).toHaveBeenCalled())
            pick(form, 'Voice to remix', /Harbor watch/)
            expect(within(form).getByText(/Blocked by the Library remix rule/)).toBeInTheDocument()
            expect(within(form).getByRole('button', { name: 'Generate remixes' })).toBeDisabled()
        })

        it('remixes an owned voice and saves the variant with parent_voice_key', async () => {
            const form = await openRemix()
            await waitFor(() => expect(mock().listAdminCatalog).toHaveBeenCalled())
            pick(form, 'Voice to remix', /Maren/)
            fireEvent.change(within(form).getByLabelText('Change to make'), { target: { value: CHANGE } })
            fireEvent.click(within(form).getByRole('button', { name: 'Generate remixes' }))
            await waitFor(() =>
                expect(mock().remixAdminVoice).toHaveBeenCalledWith(
                    readyVoice.voice_key,
                    expect.objectContaining({ voice_description: CHANGE, guidance_scale: 2, prompt_strength: 'medium', loudness: 0.5 }),
                    expect.any(AbortSignal),
                ),
            )
            await chooseAndSave('Maren, older')
            await waitFor(() =>
                expect(mock().saveAdminDesign).toHaveBeenCalledWith(
                    expect.objectContaining({ generated_voice_id: 'gen_2', parent_voice_key: readyVoice.voice_key, played_not_selected_voice_ids: ['gen_1', 'gen_3'] }),
                ),
            )
        })
    })
})
