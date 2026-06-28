import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppUpdateBanner } from './AppUpdateBanner'

const meta = {
    title: 'Components/AppUpdateBanner',
    component: AppUpdateBanner,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Global non-modal notice shown when the deployed frontend has a newer build available. It uses the ember action tone because reloading is user-initiated.',
            },
        },
    },
    argTypes: {
        updateAvailable: { control: 'boolean', description: 'Overrides version-check state for demos and tests.' },
        onReload: { action: 'reload', description: 'Called when the reload button is pressed.' },
    },
    args: {
        updateAvailable: true,
    },
} satisfies Meta<typeof AppUpdateBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {}

export const Hidden: Story = {
    args: {
        updateAvailable: false,
    },
}
