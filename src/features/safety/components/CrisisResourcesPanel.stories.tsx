import type { Meta, StoryObj } from '@storybook/react-vite'
import { ensureSafetyLocales } from '../test/ensureSafetyLocales'
import { CrisisResourcesPanel } from './CrisisResourcesPanel'

// Until the `voiceSafety` copy is spread into the app bundles; a no-op afterwards.
ensureSafetyLocales()

const meta = {
    title: 'Features/Safety/CrisisResourcesPanel',
    component: CrisisResourcesPanel,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'What a voice safety pause shows (R2-BE-01): voice is paused, when it comes back if the server says, and the generic "contact your local emergency services" line in ember. Named crisis lines are legal content and stay hidden until counsel signs them, so a pending placeholder never renders.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="max-w-[420px] rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        retryAfterSeconds: { control: 'number', description: 'Seconds until voice resumes; empty for an open-ended pause.' },
        className: { control: false },
    },
    args: { retryAfterSeconds: 900 },
} satisfies Meta<typeof CrisisResourcesPanel>

export default meta
type Story = StoryObj<typeof meta>

/** A timed pause: voice comes back in about 15 minutes. */
export const TimedPause: Story = {}

/** The server gave no end: the pause holds for this session. */
export const OpenEnded: Story = { args: { retryAfterSeconds: null } }
