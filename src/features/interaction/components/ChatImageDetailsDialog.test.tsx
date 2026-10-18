import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import type { ChatImageGeneration } from '@/shared'
import { gptProfile, kreaProfile, personalProfile } from '@/features/imageProfiles/imageProfileFixtures'
import { imageCredentialSession } from '@/features/imageProfiles/imageCredentialSession'
import { ChatImageDetailsDialog, type ChatImageDetailsDialogProps } from './ChatImageDetailsDialog'

vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (src?: string | null) => ({ src: src ?? null, error: null }),
}))

const profiles = [gptProfile, kreaProfile, personalProfile]

const generation: ChatImageGeneration = {
    job_id: 'chat-img-1',
    assistant_message_id: 101,
    turn_id: 'turn-1',
    status: 'completed',
    assets: [{ asset_id: 'asset-1', url: '/images/assets/asset-1', content_type: 'image/png', width: 1344, height: 768, seed: 7 }],
    trigger: 'auto',
    prompt: 'Lyra lifts a candle before the moonlit gate.',
    prompt_edited: false,
    model_prompt: 'Painterly fantasy illustration. Lyra lifts a candle before the moonlit gate.',
    model: 'fal-ai/krea-2/turbo',
    model_display_name: 'Krea 2 Turbo',
    provider: 'fal',
    credential_mode: 'platform',
    image_profile_id: kreaProfile.profile_id,
    profile_name: 'Krea 2 Turbo',
    credit_cost: 1,
    aspect_ratio: '16:9',
    created_at: '2026-10-16T12:00:00',
}

function renderDialog(props: Partial<ChatImageDetailsDialogProps> = {}) {
    const handlers = { onClose: vi.fn(), onRegenerate: vi.fn() }
    render(<ChatImageDetailsDialog generation={generation} profiles={profiles} defaultId={kreaProfile.profile_id} canGenerate {...handlers} {...props} />)
    return handlers
}

beforeEach(async () => { await i18n.changeLanguage('en') })
afterEach(() => vi.restoreAllMocks())

describe('ChatImageDetailsDialog', () => {
    it('shows the image, its scene prompt, the model and how it was made', () => {
        renderDialog()
        const dialog = screen.getByRole('dialog', { name: 'Scene image' })
        expect(within(dialog).getByRole('img', { name: 'Scene image' })).toHaveAttribute('src', '/images/assets/asset-1')
        expect(within(dialog).getByRole('textbox', { name: 'Scene prompt' })).toHaveValue(generation.prompt)
        expect(within(dialog).getByText('1344 × 768')).toBeInTheDocument()
        expect(within(dialog).getByText('With the reply')).toBeInTheDocument()
        expect(within(dialog).getByText('Ready')).toBeInTheDocument()
        expect(within(dialog).getByText(generation.model_prompt!)).toBeInTheDocument()
    })

    it('regenerates on the same model without resending an unchanged prompt', () => {
        const handlers = renderDialog()
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate · 1 credit' }))
        expect(handlers.onRegenerate).toHaveBeenCalledWith({ imageProfileId: kreaProfile.profile_id })
        expect(handlers.onClose).toHaveBeenCalled()
    })

    it('regenerates an edited prompt on another model, and can reset the edit', async () => {
        const handlers = renderDialog()
        const prompt = screen.getByRole('textbox', { name: 'Scene prompt' })
        fireEvent.change(prompt, { target: { value: 'A storm breaks over the harbor.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Reset to original' }))
        expect(prompt).toHaveValue(generation.prompt)

        fireEvent.change(prompt, { target: { value: '  A storm breaks over the harbor.  ' } })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(await screen.findByRole('option', { name: /GPT Image 2.5 Flare/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate · 3 credits' }))

        expect(handlers.onRegenerate).toHaveBeenCalledWith({ prompt: 'A storm breaks over the harbor.', imageProfileId: gptProfile.profile_id })
    })

    it('refuses links and over-long scenes before sending', () => {
        const handlers = renderDialog()
        const prompt = screen.getByRole('textbox', { name: 'Scene prompt' })
        fireEvent.change(prompt, { target: { value: 'See https://example.com/ref.png' } })
        expect(screen.getByText('Describe the scene in plain words, without links.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^Regenerate/ })).toBeDisabled()

        fireEvent.change(prompt, { target: { value: 'x'.repeat(2001) } })
        expect(screen.getByText('Keep the scene under 2000 characters.')).toBeInTheDocument()
        expect(handlers.onRegenerate).not.toHaveBeenCalled()
    })

    it('asks for the key before regenerating on a personal profile', async () => {
        vi.spyOn(imageCredentialSession, 'has').mockReturnValue(false)
        vi.spyOn(imageCredentialSession, 'remember').mockImplementation(() => {})
        const handlers = renderDialog({ generation: { ...generation, image_profile_id: personalProfile.profile_id, credential_mode: 'user_byok', credit_cost: 0 } })

        fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
        expect(handlers.onRegenerate).not.toHaveBeenCalled()
        const keyDialog = await screen.findByRole('dialog', { name: /fal/i })
        fireEvent.change(keyDialog.querySelector('input[type="password"]')!, { target: { value: 'fal-user-key' } })
        fireEvent.click(within(keyDialog).getByRole('button', { name: /use/i }))

        expect(handlers.onRegenerate).toHaveBeenCalledWith({ imageProfileId: personalProfile.profile_id, provider: 'fal' })
    })

    it('is read-only when the chat cannot make new images', () => {
        renderDialog({ canGenerate: false })
        expect(screen.queryByRole('button', { name: /^Regenerate/ })).toBeNull()
        expect(screen.getByRole('textbox', { name: 'Scene prompt' })).toHaveAttribute('readonly')
        expect(screen.queryByRole('combobox')).toBeNull()
    })

    it('says so when the image cannot be loaded instead of showing a broken picture', () => {
        renderDialog()
        fireEvent.error(screen.getByRole('img', { name: 'Scene image' }))
        expect(screen.queryByRole('img', { name: 'Scene image' })).toBeNull()
        expect(screen.getByText('The image could not be loaded. Refresh the page to try again.')).toBeInTheDocument()
    })

    it('explains an older image whose prompt was not kept', () => {
        renderDialog({ generation: { ...generation, prompt: null, model_prompt: null } })
        expect(screen.getByRole('textbox', { name: 'Scene prompt' })).toHaveValue('')
        expect(screen.getByText(/made before prompts were kept/)).toBeInTheDocument()
    })
})
