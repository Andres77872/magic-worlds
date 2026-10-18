import type { Meta, StoryObj } from '@storybook/react-vite'
import { GeneratedImage, SceneImageNotice, SceneImagePlaceholder } from './GeneratedImage'
import scene from '@/assets/marketing/features/adventures.webp'

const meta = {
    title: 'Interaction/GeneratedImage',
    component: GeneratedImage,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'Scene-image feedback keeps space for the artwork and announces generation stages while the conversation stays available. Its pieces (the aspect-reserved placeholder, the painted image with overlay actions, and the quiet notice line) also build ChatTurnImages, which shows every image of a turn.' } },
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
/** Image generation switched off server-side renders nothing. */
export const Unavailable: Story = { args: { status: 'unavailable' } }
/** The wait between the end of the reply and the image's first frame. */
export const StartingPlaceholder: Story = { render: () => <SceneImagePlaceholder stage="starting" /> }
/** A state with no artwork that is not a failure. */
export const QuietNotice: Story = { render: () => <SceneImageNotice tone="quiet">This image is no longer available.</SceneImageNotice> }
export const Completed: Story = {
    args: { status: 'completed', width: 1536, height: 1024 },
    render: (args) => <GeneratedImage {...args} url={new URL(scene, window.location.href).href} />,
}
