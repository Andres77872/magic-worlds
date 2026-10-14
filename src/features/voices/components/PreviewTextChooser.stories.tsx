import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { PreviewTextId } from '@/shared'
import { BUILT_IN_PREVIEW_TEXTS } from '../previewTexts'
import { PreviewTextChooser } from './PreviewTextChooser'
import { PreviewTranscript } from './RecipePreviewPlayer'

const meta = {
    title: 'Voices/PreviewTextChooser',
    component: PreviewTextChooser,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'Chooses which fixed line a recipe preview reads (narration, dialogue or thought). Previews never take free text (D18); the exact line shows underneath as the transcript.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[460px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        value: { control: 'inline-radio', options: ['narration', 'dialogue', 'thought'] },
        onChange: { control: false },
    },
    args: {
        value: 'narration',
        onChange: () => undefined,
    },
} satisfies Meta<typeof PreviewTextChooser>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

function WithTranscript() {
    const [value, setValue] = useState<PreviewTextId>('dialogue')
    return (
        <div className="flex flex-col gap-4">
            <PreviewTextChooser value={value} onChange={setValue} />
            <PreviewTranscript text={BUILT_IN_PREVIEW_TEXTS.en[value]} />
        </div>
    )
}

/** The chooser with the line it will read. */
export const ChooserWithTranscript: Story = {
    parameters: { controls: { disable: true } },
    render: () => <WithTranscript />,
}
