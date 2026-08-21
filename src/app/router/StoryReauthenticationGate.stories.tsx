import type { Meta, StoryObj } from '@storybook/react-vite'
import { StoryReauthenticationGate } from './StoryReauthenticationGate'

const meta = {
    title: 'Components/StoryReauthenticationGate',
    component: StoryReauthenticationGate,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Blocking Story Studio reauthentication state. The editor remains mounted and inert behind this gate so a same-account login can restore an unsaved chapter draft.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="relative min-h-screen bg-ink-800">
                <div aria-hidden className="p-8 font-narrative text-parchment-400">
                    Unsaved chapter draft remains mounted behind the gate.
                </div>
                <Story />
            </div>
        ),
    ],
    args: {
        onLogin: () => {},
        onContinueSignedOut: () => {},
    },
} satisfies Meta<typeof StoryReauthenticationGate>

export default meta
type Story = StoryObj<typeof meta>

export const ExpiredSession: Story = {}
