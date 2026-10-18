import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ReactNode } from 'react'
import type { ChatImageGeneration } from '../../../shared'
import type { ChatTurnImagesView } from '../hooks/useChatImages'
import { ChatImageActionsContext, type ChatImageActions } from './chatImageActions'
import { ChatTurnImages } from './ChatTurnImages'

vi.mock('@/infrastructure/api/useAuthenticatedMediaUrl', () => ({
    useAuthenticatedMediaUrl: (url?: string | null) => ({ src: url ?? undefined, loading: false, error: null }),
}))

const asset = (id: string) => ({ asset_id: id, url: `/generated-images/${id}.png`, content_type: 'image/png' as const, width: 1536, height: 1024 })

function view(generations: ChatImageGeneration[], extra: Partial<ChatTurnImagesView> = {}): ChatTurnImagesView {
    return { messageId: 101, generations, selectedJobId: generations[generations.length - 1]?.job_id ?? null, scheduled: false, stalled: false, ...extra }
}

let actions: {
    canGenerate: boolean
    regenerate: Mock<ChatImageActions['regenerate']>
    select: Mock<ChatImageActions['select']>
    addKeyAndGenerate: Mock<NonNullable<ChatImageActions['addKeyAndGenerate']>>
}

function renderImages(node: ReactNode, value: ChatImageActions | null = actions) {
    return render(<ChatImageActionsContext.Provider value={value}>{node}</ChatImageActionsContext.Provider>)
}

beforeEach(() => {
    actions = {
        canGenerate: true,
        regenerate: vi.fn<ChatImageActions['regenerate']>(),
        select: vi.fn<ChatImageActions['select']>(),
        addKeyAndGenerate: vi.fn<NonNullable<ChatImageActions['addKeyAndGenerate']>>(),
    }
})

describe('ChatTurnImages', () => {
    it('renders nothing while the reply streams or before its message id is known', () => {
        const images = view([], { scheduled: true })
        const { container, rerender } = renderImages(<ChatTurnImages messageId={101} images={images} streaming />)
        expect(container).toBeEmptyDOMElement()
        rerender(<ChatImageActionsContext.Provider value={actions}><ChatTurnImages images={images} /></ChatImageActionsContext.Provider>)
        expect(container).toBeEmptyDOMElement()
    })

    it('holds one placeholder from "starting" through each job stage', () => {
        const { rerender } = renderImages(<ChatTurnImages messageId={101} images={view([], { scheduled: true })} />)
        expect(screen.getByRole('status')).toHaveTextContent('Starting image generation…')
        for (const [status, copy] of [['pending', 'Image queued…'], ['in_progress', 'Generating image…'], ['mirroring', 'Saving image…']] as const) {
            rerender(<ChatImageActionsContext.Provider value={actions}><ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status, assets: [], aspect_ratio: '16:9' }])} /></ChatImageActionsContext.Provider>)
            expect(screen.getByRole('status')).toHaveTextContent(copy)
            expect(screen.getByRole('status').closest('figure')).toHaveStyle({ aspectRatio: String(16 / 9) })
        }
    })

    it('offers Retry for an image that never started', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([], { scheduled: true, stalled: true })} />)
        expect(screen.getByText("The scene image didn't start.")).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, {})
    })

    it('paints a completed image with its overlay actions, the regenerate cost and details', () => {
        const openDetails = vi.fn()
        renderImages(
            <ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status: 'completed', assets: [asset('a1')], credit_cost: 2, image_profile_id: 'prof-1' }])} />,
            { ...actions, openDetails },
        )
        expect(screen.getByRole('status')).toHaveTextContent('Loading image…')
        fireEvent.load(screen.getByRole('img', { name: 'Generated scene' }))
        expect(screen.queryByRole('status')).not.toBeInTheDocument()

        const toolbar = screen.getByRole('toolbar', { name: 'Scene image actions' })
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate image (2 credits)' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, { imageProfileId: 'prof-1' })
        fireEvent.click(screen.getByRole('button', { name: 'Image details' }))
        expect(openDetails).toHaveBeenCalledWith(101, 'img-1')
        fireEvent.click(screen.getByRole('button', { name: 'Full size' }))
        expect(screen.getByRole('dialog', { name: 'Generated scene' })).toBeInTheDocument()
        expect(toolbar).toBeInTheDocument()
    })

    it('pages between the images of a turn', () => {
        const generations: ChatImageGeneration[] = [
            { job_id: 'img-1', status: 'completed', assets: [asset('a1')] },
            { job_id: 'img-2', status: 'in_progress', assets: [] },
        ]
        const { rerender } = renderImages(<ChatTurnImages messageId={101} images={view(generations)} />)
        expect(screen.getByText('Image 2 of 2')).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Generating image…')
        fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))
        expect(actions.select).toHaveBeenCalledWith(101, 'img-1')

        rerender(<ChatImageActionsContext.Provider value={actions}><ChatTurnImages messageId={101} images={view(generations, { selectedJobId: 'img-1' })} /></ChatImageActionsContext.Provider>)
        expect(screen.getByText('Image 1 of 2')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Generated scene' })).toHaveAttribute('src', '/generated-images/a1.png')
        expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled()
    })

    it('explains a failed image and retries it on the same profile', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status: 'failed', assets: [], image_profile_id: 'prof-1', error: { category: 'provider', detail: 'The provider could not draw this scene.' } }])} />)
        expect(screen.getByRole('alert')).toHaveTextContent('The provider could not draw this scene.')
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, { imageProfileId: 'prof-1' })
    })

    it('says when the image limit is reached, without a retry', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([], { startFailure: { status: 'quota_exceeded', error: { category: 'quota', detail: 'Limit', code: 'quota_exceeded' } } })} />)
        expect(screen.getByRole('alert')).toHaveTextContent('You have reached your image limit for now.')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('asks for the provider key when a personal profile has none', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status: 'failed', assets: [], image_profile_id: 'prof-byok', provider: 'fal',
            error: { category: 'credentials', detail: 'Missing', code: 'provider_credentials_missing' } }])} />)
        expect(screen.getByText('This image model runs on your own key. Add it to generate.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add key & generate' }))
        expect(actions.addKeyAndGenerate).toHaveBeenCalledWith(101, { provider: 'fal', imageProfileId: 'prof-byok' })
    })

    it('regenerates a personal-key image on its own provider so the held key rides along', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status: 'completed', assets: [asset('a1')], image_profile_id: 'prof-byok', provider: 'fal', credential_mode: 'user_byok' }])} />)
        fireEvent.load(screen.getByRole('img', { name: 'Generated scene' }))
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate image' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, { imageProfileId: 'prof-byok', provider: 'fal' })
    })

    it('retries a refused profile on the default one', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([], { startFailure: { status: 'failed', image_profile_id: 'prof-router', provider: 'openrouter',
            error: { category: 'request', detail: 'This profile cannot draw chat scenes.', code: 'chat_image_provider_unsupported' } } })} />)
        expect(screen.getByRole('alert')).toHaveTextContent('This profile cannot draw chat scenes.')
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, {})
    })

    it('says a removed image is gone and offers a new one', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status: 'completed', assets: [] }])} />)
        expect(screen.getByRole('status')).toHaveTextContent('This image is no longer available.')
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate image' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, {})
    })

    it('keeps the shown image and explains a refused regenerate under it', () => {
        renderImages(<ChatTurnImages messageId={101} images={view([{ job_id: 'img-1', status: 'completed', assets: [asset('a1')] }],
            { startFailure: { status: 'failed', error: { category: 'request', detail: 'The image could not be started.' } } })} />)
        expect(screen.getByRole('img', { name: 'Generated scene' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('The image could not be started.')
    })

    it('offers a quiet Generate image for a turn with a prompt and no images', () => {
        const { rerender } = renderImages(<ChatTurnImages messageId={101} hasPrompt />)
        fireEvent.click(screen.getByRole('button', { name: 'Generate image' }))
        expect(actions.regenerate).toHaveBeenCalledWith(101, {})

        rerender(<ChatImageActionsContext.Provider value={{ ...actions, canGenerate: false }}><ChatTurnImages messageId={101} hasPrompt /></ChatImageActionsContext.Provider>)
        expect(screen.queryByRole('button', { name: 'Generate image' })).not.toBeInTheDocument()
    })

    it('renders read-only without actions', () => {
        renderImages(<ChatTurnImages messageId={101} hasPrompt images={view([
            { job_id: 'img-1', status: 'completed', assets: [asset('a1')] },
            { job_id: 'img-2', status: 'failed', assets: [], error: { category: 'provider', detail: 'Failed.' } },
        ])} />, null)
        expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled()
    })
})
