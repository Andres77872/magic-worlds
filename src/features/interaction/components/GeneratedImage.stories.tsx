import type { Meta, StoryObj } from '@storybook/react-vite'
import { GeneratedImage } from './GeneratedImage'
import scene from '@/assets/marketing/features/adventures.webp'

const meta = {
    title: 'Interaction/GeneratedImage',
    component: GeneratedImage,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'Scene-image feedback keeps space for the artwork and announces generation stages while the conversation stays available.' } },
    },
    decorators: [(Story) => <div className="mx-auto max-w-xl"><Story /></div>],
    args: { status: 'in_progress' },
} satisfies Meta<typeof GeneratedImage>

export default meta
type Story = StoryObj<typeof meta>

export const Generating: Story = {}
export const Queued: Story = { args: { status: 'pending' } }
export const Saving: Story = { args: { status: 'mirroring' } }
export const Failed: Story = { args: { status: 'failed' } }
export const Completed: Story = {
    args: { status: 'completed', width: 1536, height: 1024 },
    render: (args) => <GeneratedImage {...args} url={new URL(scene, window.location.href).href} />,
}
