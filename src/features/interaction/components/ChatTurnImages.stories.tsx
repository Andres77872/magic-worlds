import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import type { ChatImageGeneration } from '../../../shared'
import type { ChatTurnImagesView } from '../hooks/useChatImages'
import { ChatImageActionsContext, type ChatImageActions } from './chatImageActions'
import { ChatTurnImages } from './ChatTurnImages'
import scene from '@/assets/marketing/features/adventures.webp'

const sceneUrl = () => new URL(scene, window.location.href).href

const completed = (jobId: string, extra: Partial<ChatImageGeneration> = {}): ChatImageGeneration => ({
    job_id: jobId,
    status: 'completed',
    assets: [{ asset_id: `${jobId}-asset`, url: sceneUrl(), content_type: 'image/webp', width: 1536, height: 1024 }],
    model_display_name: 'Flux schnell',
    credit_cost: 1,
    trigger: 'auto',
    ...extra,
})

function view(generations: ChatImageGeneration[], extra: Partial<ChatTurnImagesView> = {}): ChatTurnImagesView {
    return { messageId: 101, generations, selectedJobId: generations[generations.length - 1]?.job_id ?? null, scheduled: false, stalled: false, ...extra }
}

const actions: ChatImageActions = {
    canGenerate: true,
    regenerate: fn(),
    select: fn(),
    addKeyAndGenerate: fn(),
    openDetails: fn(),
}

const meta = {
    title: 'Interaction/ChatTurnImages',
    component: ChatTurnImages,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: 'Every scene image of one chat turn. One aspect-reserved box carries the lifecycle from "starting" to the painted image; a pager steps back through earlier images, and failures, a missing key, a quota or a removed image each say so in a quiet line. Arcane marks the AI at work; overlay actions appear on hover and focus, and always on touch.',
            },
        },
    },
    decorators: [(Story) => (
        <ChatImageActionsContext.Provider value={actions}>
            <div className="mx-auto max-w-xl"><Story /></div>
        </ChatImageActionsContext.Provider>
    )],
    argTypes: {
        images: { control: false },
        messageId: { control: false },
        hasPrompt: { control: 'boolean', description: 'The turn has a scene prompt, so an image can be generated on request.' },
        streaming: { control: 'boolean' },
    },
    args: { messageId: 101, images: view([], { scheduled: true }) },
} satisfies Meta<typeof ChatTurnImages>

export default meta
type Story = StoryObj<typeof meta>

/** The reply has finished and the server has scheduled its image; no job has answered yet. */
export const Starting: Story = {}

export const Queued: Story = { args: { images: view([{ job_id: 'img-1', status: 'pending', assets: [] }]) } }

export const Generating: Story = { args: { images: view([{ job_id: 'img-1', status: 'in_progress', assets: [], aspect_ratio: '3:2' }]) } }

/** Hover or focus the image for Details, Regenerate (with its cost) and Full size. */
export const Completed: Story = { args: { images: view([completed('img-1')]) } }

function PagedImages() {
    const generations = [completed('img-1'), completed('img-2', { trigger: 'regenerate' }), { job_id: 'img-3', status: 'in_progress', assets: [], trigger: 'regenerate', prompt_edited: true } satisfies ChatImageGeneration]
    const [selected, setSelected] = useState('img-3')
    return (
        <ChatImageActionsContext.Provider value={{ ...actions, select: (_messageId, jobId) => setSelected(jobId) }}>
            <ChatTurnImages messageId={101} images={view(generations, { selectedJobId: selected })} />
        </ChatImageActionsContext.Provider>
    )
}

/** A new image is generating; ‹ › pages back to the earlier ones meanwhile. */
export const MultiplePages: Story = { render: () => <PagedImages /> }

export const Failed: Story = {
    args: { images: view([{ job_id: 'img-1', status: 'failed', assets: [], error: { category: 'provider', detail: 'The provider could not draw this scene. Try again.' } }]) },
}

/** A personal-key model without a key held in this tab. */
export const KeyNeeded: Story = {
    args: { images: view([{ job_id: 'img-1', status: 'failed', assets: [], provider: 'fal', credential_mode: 'user_byok', image_profile_id: 'prof-byok',
        error: { category: 'credentials', detail: 'A key is needed.', code: 'provider_credentials_missing' } }]) },
}

export const QuotaReached: Story = {
    args: { images: view([], { startFailure: { status: 'quota_exceeded', error: { category: 'quota', detail: 'Limit reached.', code: 'quota_exceeded' } } }) },
}

/** Scheduled 30 seconds ago and still no job. */
export const DidNotStart: Story = { args: { images: view([], { scheduled: true, stalled: true }) } }

export const ImageRemoved: Story = { args: { images: view([{ job_id: 'img-1', status: 'completed', assets: [] }]) } }

/** Images were off for this turn, or it failed before a job existed: a quiet way to make one. */
export const GenerateOnRequest: Story = { args: { images: undefined, hasPrompt: true } }

/** An archived workspace: images show, nothing new is offered. */
export const ReadOnly: Story = {
    args: { images: view([completed('img-1'), completed('img-2')]) },
    decorators: [(Story) => <ChatImageActionsContext.Provider value={{ ...actions, canGenerate: false, openDetails: undefined }}><Story /></ChatImageActionsContext.Provider>],
}
