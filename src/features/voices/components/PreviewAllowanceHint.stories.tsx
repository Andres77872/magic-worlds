import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PreviewAllowanceHint, PreviewProblemNotice } from './PreviewAllowanceHint'

const meta = {
    title: 'Voices/PreviewAllowanceHint',
    component: PreviewAllowanceHint,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'The polite live region next to a recipe-preview button: previews left today, the daily limit, or "Generating preview…" while a render is in flight. Empty when the server reports no count.',
            },
        },
    },
    argTypes: {
        previewsLeft: { control: 'number' },
        loading: { control: 'boolean' },
    },
    args: {
        previewsLeft: 3,
        loading: false,
    },
} satisfies Meta<typeof PreviewAllowanceHint>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <div className="flex flex-col gap-2">
            <PreviewAllowanceHint previewsLeft={3} />
            <PreviewAllowanceHint previewsLeft={1} />
            <PreviewAllowanceHint previewsLeft={0} />
            <PreviewAllowanceHint previewsLeft={2} loading />
        </div>
    ),
}

/**
 * The ElevenLabs Studio and editor's preview errors with their 05 §6.4 action:
 * "Not enough credits" links to the membership page (the editor opens it in a
 * new tab), a 409 `voice_unavailable` offers "Pick another voice". The daily
 * limit renders nothing here (the hint above says it).
 */
export const ProblemNotices: Story = {
    parameters: { controls: { disable: true } },
    render: () => (
        <div className="flex w-[480px] flex-col gap-4">
            <PreviewProblemNotice problem="noCredits" />
            <PreviewProblemNotice problem="noCredits" membershipInNewTab />
            <PreviewProblemNotice problem="voiceUnavailable" onPickVoice={fn()} />
            <PreviewProblemNotice problem="rateLimited" />
            <PreviewProblemNotice problem="unavailable" />
        </div>
    ),
}
