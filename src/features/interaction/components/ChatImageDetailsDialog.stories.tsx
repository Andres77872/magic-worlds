import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ChatImageGeneration } from '@/shared'
import { gptProfile, kreaProfile, personalProfile } from '@/features/imageProfiles/imageProfileFixtures'
import { Button } from '@/ui/primitives'
import { ChatImageDetailsDialog } from './ChatImageDetailsDialog'
import sceneArt from '@/assets/marketing/features/adventures.webp'

const scene: ChatImageGeneration = {
    job_id: 'chat-img-1',
    assistant_message_id: 101,
    turn_id: 'turn-1',
    status: 'completed',
    assets: [{ asset_id: 'asset-1', url: new URL(sceneArt, window.location.href).href, content_type: 'image/webp', width: 1536, height: 1024, seed: 7 }],
    trigger: 'auto',
    prompt: 'Lyra lifts a candle before the moonlit gate as violet rain begins to fall.',
    prompt_edited: false,
    model_prompt: 'Painterly fantasy illustration. Lyra lifts a candle before the moonlit gate as violet rain begins to fall. One clear focal moment, low-key candlelight.',
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

const meta = {
    title: 'Interaction/ChatImageDetailsDialog', component: ChatImageDetailsDialog, tags: ['autodocs'],
    parameters: { docs: { description: { component: 'One scene image’s prompt, model and metadata. The scene prompt is editable; Regenerate draws it again on the chosen model and adds the new image to the turn, keeping this one.' } } },
    argTypes: { generation: { control: false }, profiles: { control: false }, onClose: { control: false }, onRegenerate: { control: false } },
    args: {
        generation: scene, profiles: [gptProfile, kreaProfile, personalProfile], defaultId: kreaProfile.profile_id, canGenerate: true,
        onClose: () => {}, onRegenerate: () => {},
    },
    render: function DialogDemo(args) {
        const [open, setOpen] = useState(true)
        return <>
            <Button onClick={() => setOpen(true)}>Open scene image</Button>
            <ChatImageDetailsDialog {...args} generation={open ? args.generation : null} onClose={() => setOpen(false)} />
        </>
    },
} satisfies Meta<typeof ChatImageDetailsDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Completed: Story = {}
export const EditedRegeneration: Story = {
    args: { generation: { ...scene, job_id: 'chat-img-2', trigger: 'regenerate', prompt_edited: true,
        prompt: 'The gate splits open and silver light floods the rain-dark clearing.', image_profile_id: gptProfile.profile_id,
        profile_name: 'GPT Image 2.5 Flare', model: 'openai/gpt-image-2.5/flare/text-to-image', model_display_name: 'GPT Image 2.5 Flare', credit_cost: 3 } },
}
export const PersonalKey: Story = {
    args: { generation: { ...scene, image_profile_id: personalProfile.profile_id, profile_name: 'My Sana', credential_mode: 'user_byok', credit_cost: 0,
        model: 'fal-ai/sana', model_display_name: 'Sana' } },
}
export const OlderImageWithoutPrompt: Story = { args: { generation: { ...scene, prompt: null, model_prompt: null } } }
export const StillDrawing: Story = { args: { generation: { ...scene, status: 'in_progress', assets: [] } } }
export const ReadOnly: Story = { args: { canGenerate: false } }
