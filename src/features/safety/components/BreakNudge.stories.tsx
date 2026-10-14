import type { Meta, StoryObj } from '@storybook/react-vite'
import { ensureSafetyLocales } from '../test/ensureSafetyLocales'
import { BreakNudge } from './BreakNudge'

// Until the `voiceSafety` copy is spread into the app bundles; a no-op afterwards.
ensureSafetyLocales()

const meta = {
    title: 'Features/Safety/BreakNudge',
    component: BreakNudge,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component:
                    'A neutral, dismissible break reminder (R2-BE-01) after `minutes` of continuous voice activity. It never stops playback; a dismissal snoozes it for another interval, and 15 idle minutes reset the count. `minutes` null (every caller without companion safeguards) means never. These stories use a few seconds so the nudge appears while you watch.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="w-[420px]">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        minutes: { control: 'number', description: 'Minutes of activity before the nudge; null means never.' },
        active: { control: 'boolean', description: 'A call is live or narration is playing.' },
        className: { control: false },
    },
    args: { minutes: 0.05, active: true },
} satisfies Meta<typeof BreakNudge>

export default meta
type Story = StoryObj<typeof meta>

/** Appears after three seconds of activity; dismiss it to snooze for another three. */
export const AfterActivity: Story = {}

/** Idle: the count does not advance, so nothing appears. */
export const Idle: Story = { args: { active: false } }

/** No safeguards for this caller: never appears. */
export const Never: Story = { args: { minutes: null } }
