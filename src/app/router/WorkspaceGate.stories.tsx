import type { Meta, StoryObj } from '@storybook/react-vite'
import { HiddenWorkspacesNotice, WorkspaceStaleDialog, WorkspaceStaleNotice, WorkspaceUnavailableGate } from './WorkspaceGate'

const meta = {
    title: 'Components/WorkspaceGate',
    component: WorkspaceUnavailableGate,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Workspace R1 rollout states for private pages. The handshake failing shows the unavailable gate (with retry, never an empty library); a stale build shows the reload dialog over the still-mounted page, or the in-page notice when no workspace was ever selected. None of them reload by themselves.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="flex min-h-screen flex-col bg-ink-800">
                <Story />
            </div>
        ),
    ],
    args: {
        onRetry: () => {},
    },
} satisfies Meta<typeof WorkspaceUnavailableGate>

export default meta
type Story = StoryObj<typeof meta>

/** The API is unreachable or is not the Workspace R1 API yet. */
export const Unavailable: Story = {}

/** This build is older than the API and never selected a workspace. */
export const StaleNotice: Story = {
    render: () => <WorkspaceStaleNotice onReload={() => {}} />,
}

/** A `WORKSPACE_REQUIRED` response while a private page is open. */
export const StaleDialog: Story = {
    render: () => (
        <div className="p-8 font-narrative text-parchment-400">
            Unsaved text stays behind the dialog.
            <WorkspaceStaleDialog open onReload={() => {}} onDismiss={() => {}} />
        </div>
    ),
}

/** Flag off while the account has more than one active workspace. */
export const HiddenWorkspaces: Story = {
    render: () => <HiddenWorkspacesNotice />,
}
