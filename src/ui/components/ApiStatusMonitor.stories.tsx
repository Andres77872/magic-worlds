import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Decorator } from '@storybook/react-vite'
import type { ApiDependencyService } from '@/infrastructure/api'
import { ApiStatusMonitor } from './ApiStatusMonitor'

const services: ApiDependencyService[] = [
    { id: 'api', label: 'Magic Worlds API', status: 'ok' },
    { id: 'mysql', label: 'MySQL', status: 'ok', latency_ms: 3 },
    { id: 'auth', label: 'API Auth', status: 'ok', latency_ms: 52 },
    { id: 'llm', label: 'LLM Proxy', status: 'ok', latency_ms: 5 },
    { id: 'image', label: 'Image Engine', status: 'ok' },
    { id: 'theme', label: 'Theme Song Engine', status: 'ok' },
    { id: 'content', label: 'Content Generation', status: 'ok', latency_ms: 3 },
    { id: 'tts', label: 'TTS Engine', status: 'ok' },
    { id: 'voice', label: 'Voice Call', status: 'ok' },
]

const servicesWithOutage: ApiDependencyService[] = services.map((service) =>
    service.id === 'auth'
        ? { ...service, status: 'offline', latency_ms: undefined, message: 'Connection timed out after 3s.' }
        : service,
)

const CHECKED_AT = '2026-06-15T05:29:03.000Z'

// The popover is anchored bottom-left of the rail button and grows up/right, so
// give the canvas room and pin the trigger to the bottom of the frame.
const railFrame: Decorator = (Story) => (
    <div className="relative flex min-h-[34rem] w-[15rem] items-end">
        <Story />
    </div>
)

const meta = {
    title: 'Components/ApiStatusMonitor',
    component: ApiStatusMonitor,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The floating backend-dependency monitor opened from the sidebar API-status button. Anchored to the rail (not a modal), it rises in with the app overlay motion and lists each dependency with a status dot, latency, and badge. Verdant reads healthy, blood reads down, and the initial poll shows a parchment "checking" pulse.',
            },
        },
    },
    decorators: [railFrame],
    argTypes: {
        status: { control: 'inline-radio', options: ['checking', 'online', 'offline'] },
        collapsed: { control: 'boolean' },
        defaultOpen: { control: 'boolean' },
        services: { control: false },
        checkedAt: { control: false },
    },
    args: {
        status: 'online',
        services,
        checkedAt: CHECKED_AT,
        collapsed: false,
        defaultOpen: true,
    },
} satisfies Meta<typeof ApiStatusMonitor>

export default meta
type Story = StoryObj<typeof meta>

export const AllOnline: Story = {}

export const DependencyOffline: Story = {
    args: { status: 'offline', services: servicesWithOutage },
}

export const Checking: Story = {
    args: { status: 'checking', services: [], checkedAt: undefined },
}

export const DetailsUnavailable: Story = {
    args: { status: 'online', services: [], checkedAt: undefined },
}
