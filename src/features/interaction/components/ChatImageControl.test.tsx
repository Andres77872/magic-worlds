import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { gptProfile, kreaProfile, personalProfile } from '@/features/imageProfiles/imageProfileFixtures'
import { imageCredentialSession } from '@/features/imageProfiles/imageCredentialSession'
import { ChatImageControl, type ChatImageControlProps } from './ChatImageControl'

const profiles = [gptProfile, kreaProfile, personalProfile]

function renderControl(props: Partial<ChatImageControlProps> = {}) {
    const handlers = { onToggle: vi.fn(), onSelectProfile: vi.fn(), onRetry: vi.fn() }
    render(<ChatImageControl enabled profileId={null} profiles={profiles} defaultId={kreaProfile.profile_id} {...handlers} {...props} />)
    return handlers
}

async function chooseProfile(name: string) {
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
}

beforeEach(async () => { await i18n.changeLanguage('en') })
afterEach(() => vi.restoreAllMocks())

describe('ChatImageControl', () => {
    it('toggles scene images and hides the model chip while they are off', () => {
        const handlers = renderControl({ enabled: false })
        const toggle = screen.getByRole('button', { name: 'Generated images off' })
        expect(toggle).toHaveAttribute('aria-pressed', 'false')
        expect(screen.queryByRole('button', { name: /scene image model/i })).toBeNull()

        fireEvent.click(toggle)
        expect(handlers.onToggle).toHaveBeenCalledTimes(1)
    })

    it('names the default model on the chip and lists every chat profile with its price', async () => {
        renderControl()
        const chip = screen.getByRole('button', { name: 'Scene image model: Default · Krea 2 Turbo' })
        fireEvent.click(chip)

        const popover = screen.getByRole('dialog', { name: 'Scene image model' })
        expect(within(popover).getByText('Krea 2 Turbo · 1 credit')).toBeInTheDocument()
        fireEvent.click(within(popover).getByRole('combobox'))
        expect(await screen.findByRole('option', { name: /Use my default \(Krea 2 Turbo\)/ })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /GPT Image 2.5 Flare.*3 credits/ })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /My Sana.*Your key/ })).toBeInTheDocument()
    })

    it('picks an app profile, and goes back to the default', async () => {
        const handlers = renderControl({ defaultOpen: true })
        await chooseProfile('GPT Image 2.5 Flare')
        expect(handlers.onSelectProfile).toHaveBeenLastCalledWith(gptProfile.profile_id)

        await chooseProfile('Use my default')
        expect(handlers.onSelectProfile).toHaveBeenLastCalledWith(null)
    })

    it('asks for the provider key before a personal profile is picked', async () => {
        vi.spyOn(imageCredentialSession, 'has').mockReturnValue(false)
        const remember = vi.spyOn(imageCredentialSession, 'remember').mockImplementation(() => {})
        const handlers = renderControl({ defaultOpen: true })

        await chooseProfile('My Sana')

        expect(handlers.onSelectProfile).not.toHaveBeenCalled()
        const dialog = await screen.findByRole('dialog', { name: /fal/i })
        const input = dialog.querySelector('input[type="password"]') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'fal-user-key' } })
        fireEvent.click(within(dialog).getByRole('button', { name: /use/i }))

        expect(remember).toHaveBeenCalledWith('fal', 'fal-user-key')
        expect(handlers.onSelectProfile).toHaveBeenCalledWith(personalProfile.profile_id)
    })

    it('warns on the chip when the chosen personal profile has no key in this tab', () => {
        renderControl({ profileId: personalProfile.profile_id, defaultOpen: true })
        expect(screen.getByText(/runs on your own fal\.ai key|runs on your own .* key/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add key' })).toBeInTheDocument()
    })

    it('offers a retry when the models could not be loaded', () => {
        const handlers = renderControl({ profiles: [], failed: true, defaultOpen: true })
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(handlers.onRetry).toHaveBeenCalledTimes(1)
    })
})
