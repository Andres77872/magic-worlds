import type { Meta, StoryObj } from '@storybook/react-vite'
import { BUILT_IN_PREVIEW_TEXTS } from '../previewTexts'
import { RecipePreviewPlayer } from './RecipePreviewPlayer'

// Tiny silent WAV keeps the control interactive without a backend.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

const meta = {
    title: 'Voices/RecipePreviewPlayer',
    component: RecipePreviewPlayer,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'An ephemeral recipe-preview clip with its transcript underneath. Thought previews play a little quieter (×0.708, D16); the level is set on the clip, not the playlist.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[420px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        src: { control: false },
        volume: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    },
    args: {
        src: SILENT_WAV,
        volume: 1,
        title: 'Gruff captain preview',
        transcript: BUILT_IN_PREVIEW_TEXTS.en.narration,
    },
} satisfies Meta<typeof RecipePreviewPlayer>

export default meta
type Story = StoryObj<typeof meta>

export const Narration: Story = {}

export const Thought: Story = {
    args: { volume: 0.708, transcript: BUILT_IN_PREVIEW_TEXTS.en.thought },
}

/** 05 §10 Language: a Spanish preview text carries `lang="es"`, so screen readers switch pronunciation. */
export const SpanishTranscript: Story = {
    args: { transcript: BUILT_IN_PREVIEW_TEXTS.es.dialogue, lang: 'es' },
}
