import type { Meta, StoryObj } from '@storybook/react-vite'
import { ImageGenerationStatus } from './ImageGenerationStatus'

const meta = {
    title: 'Components/Common/ImageGenerationStatus',
    component: ImageGenerationStatus,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'Accessible image-job feedback. Arcane shimmer marks AI activity; labels follow real job stages without estimated progress.' } },
    },
    args: { stage: 'in_progress' },
    argTypes: {
        stage: { control: 'inline-radio', options: ['starting', 'pending', 'in_progress', 'mirroring', 'loading', 'uploading'] },
    },
} satisfies Meta<typeof ImageGenerationStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Generating: Story = {}
export const Queued: Story = { args: { stage: 'pending' } }
export const Saving: Story = { args: { stage: 'mirroring' } }
export const Loading: Story = { args: { stage: 'loading' } }
export const Stages: Story = {
    render: () => (
        <div className="mx-auto grid max-w-2xl gap-4">
            {(['starting', 'pending', 'in_progress', 'mirroring', 'loading', 'uploading'] as const).map((stage) => (
                <ImageGenerationStatus key={stage} stage={stage} />
            ))}
        </div>
    ),
}
