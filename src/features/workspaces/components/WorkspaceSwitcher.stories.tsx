import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Workspace } from '@/shared/types'
import { WorkspaceSwitcherView } from './WorkspaceSwitcher'

function workspace(id: string, name: string, overrides: Partial<Workspace> = {}): Workspace {
    return {
        id,
        name,
        description: null,
        preferred_use: 'library',
        is_default: false,
        archived_at: null,
        row_version: 1,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        ...overrides,
    }
}

const MAIN_ID = '0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b'
const NOVEL_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

const workspaces = [
    workspace(MAIN_ID, 'Main library', { is_default: true }),
    workspace(NOVEL_ID, 'Novel A', { preferred_use: 'writing' }),
    workspace('5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b', 'Saturday campaign', { preferred_use: 'roleplay' }),
    workspace('6f7a8b9c-0d1e-4f2a-9b3c-5d6e7f8a9b0c', 'Old one-shots', { archived_at: '2026-09-01T00:00:00Z' }),
]

const meta = {
    title: 'Components/WorkspaceSwitcher',
    component: WorkspaceSwitcherView,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The sidebar workspace switcher (Workspace R1): the current workspace, the active list with the default marked, an archived section that opens read-only, then Create and Manage. Switching runs through the navigation coordinator; while it ends a call or revalidates, the trigger shows Switching.',
            },
        },
    },
    decorators: [
        (Story) => (
            <div className="h-[460px] w-56">
                <Story />
            </div>
        ),
    ],
    argTypes: {
        collapsed: { control: 'boolean' },
        panel: { control: 'boolean' },
        onSelect: { action: 'selected' },
        onCreate: { action: 'create' },
        onManage: { action: 'manage' },
    },
    args: {
        workspaces,
        selectedWorkspaceId: MAIN_ID,
        switchingTo: null,
        collapsed: false,
        panel: true,
        onSelect: () => {},
        onCreate: () => {},
        onManage: () => {},
    },
} satisfies Meta<typeof WorkspaceSwitcherView>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Open: Story = {
    args: { defaultOpen: true },
}

/** The coordinator is ending a call or revalidating the destination. */
export const Switching: Story = {
    args: { switchingTo: NOVEL_ID },
}

/** An archived workspace is open (read-only). */
export const ArchivedSelected: Story = {
    args: { selectedWorkspaceId: workspaces[3].id },
}
