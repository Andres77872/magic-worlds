import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { firstExposureKey } from '../hooks/useFirstExposure'
import { FirstExposureCallout, FirstExposureNotice } from './FirstExposureNotice'

const STORY_READER = 'storybook-first-exposure'

/** Each story starts undismissed: the dismissal is per account and browser (localStorage). */
function resetDismissal() {
    try {
        window.localStorage.removeItem(firstExposureKey(STORY_READER))
    } catch {
        // Storage blocked: the notice remembers its dismissal in memory instead.
    }
}

const meta = {
    title: 'Voices/FirstExposureNotice',
    component: FirstExposureNotice,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    '"Voices have a new engine" (R1): shown once per account and browser, only when the screen holds a voice chosen before the move that now plays as one of the new voices. Dismissing it is remembered locally.',
            },
        },
    },
    beforeEach: resetDismissal,
    decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
    argTypes: {
        hasConvertedVoice: { control: 'boolean' },
        userHash: { control: false },
        className: { control: false },
    },
    args: {
        userHash: STORY_READER,
        hasConvertedVoice: true,
    },
} satisfies Meta<typeof FirstExposureNotice>

export default meta
type Story = StoryObj<typeof meta>

/** The connected notice: dismiss it, then reload the story to see it stay gone. */
export const Playground: Story = {}

/** The callout alone, as the notice renders it. */
export const Callout: Story = {
    parameters: { controls: { disable: true } },
    render: () => <FirstExposureCallout onDismiss={fn()} />,
}

/** Nothing when no voice on the screen was converted, or signed out. */
export const Hidden: Story = {
    parameters: { controls: { disable: true } },
    render: (args) => (
        <div className="flex flex-col gap-2 font-ui text-caption text-fg-muted">
            <FirstExposureNotice {...args} userHash={null} />
            <FirstExposureNotice {...args} hasConvertedVoice={false} />
            <p>Both notices above render nothing.</p>
        </div>
    ),
}
