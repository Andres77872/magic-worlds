import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArchivedWorkspaceBannerView, WorkspaceSwitchFailureNotice, WorkspaceUnavailableTarget } from './WorkspaceNotices'

const meta = {
    title: 'Components/WorkspaceNotices',
    component: ArchivedWorkspaceBannerView,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Workspace R1 page-level states. The archived banner keeps content readable and copyable with Restore; the switch failure notice says the source workspace stayed open and offers Try again; the unavailable target replaces a link into a workspace this tab can’t open, never showing the current workspace’s data instead.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="flex min-h-[320px] flex-col bg-ink-800">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        onRestore: { action: 'restore' },
    },
    args: {
        restoring: false,
        error: null,
        onRestore: () => {},
    },
} satisfies Meta<typeof ArchivedWorkspaceBannerView>

export default meta
type Story = StoryObj<typeof meta>

export const ArchivedBanner: Story = {}

export const ArchivedBannerRestoring: Story = {
    args: { restoring: true },
}

export const ArchivedBannerError: Story = {
    args: { error: 'Could not restore the workspace. Try again.' },
}

/** The active call could not be ended, so the switch was cancelled. */
export const SwitchFailedCall: Story = {
    render: () => (
        <WorkspaceSwitchFailureNotice
            failure={{ reason: 'call', workspaceId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', retry: () => {} }}
            sourceName="Main library"
            onDismiss={() => {}}
        />
    ),
}

/** The destination was archived while the guards ran. */
export const SwitchFailedArchived: Story = {
    render: () => (
        <WorkspaceSwitchFailureNotice
            failure={{ reason: 'archived', workspaceId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', retry: () => {} }}
            sourceName="Main library"
            onDismiss={() => {}}
        />
    ),
}

export const UnavailableTarget: Story = {
    render: () => <WorkspaceUnavailableTarget showLibrary onLibrary={() => {}} onHome={() => {}} />,
}
