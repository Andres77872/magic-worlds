import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Workspace } from '@/shared/types'
import { CopyToWorkspaceDrawer, type CopyCardRef } from './CopyToWorkspaceDrawer'

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

const source = workspace('0f1e2d3c-4b5a-4978-8a6b-5c4d3e2f1a0b', 'Main library', { is_default: true })
const destinations = [
    workspace('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', 'Novel A', { preferred_use: 'writing' }),
    workspace('5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8a9b', 'Saturday campaign', { preferred_use: 'roleplay' }),
]

const cards: CopyCardRef[] = [
    { cardType: 'character', cardId: 'char_lyra', title: 'Lyra Ashwind' },
    { cardType: 'world', cardId: 'world_eldoria', title: 'Eldoria' },
    { cardType: 'item', cardId: 'item_compass', title: 'Moonlit compass' },
]

const meta = {
    title: 'Library/CopyToWorkspaceDrawer',
    component: CopyToWorkspaceDrawer,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Copy to workspace: choose the destination first, then optionally its collections. The summary explains what a copy includes. A copy is all-or-nothing: while it runs the drawer shows progress and refuses resubmission, and any error says plainly that nothing was copied. Try again reuses the request ID; changed input or Copy again starts a new one.',
            },
        },
    },
    argTypes: {
        onClose: { action: 'closed' },
        onViewCopies: { action: 'view copies' },
    },
    args: {
        open: true,
        source,
        cards,
        destinations,
        onClose: () => {},
        onViewCopies: () => {},
    },
} satisfies Meta<typeof CopyToWorkspaceDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseDestination: Story = {}

/** More than 20 cards: blocked with the reason, before any request. */
export const OverCopyLimit: Story = {
    args: {
        cards: Array.from({ length: 23 }, (_, index) => ({ cardType: 'item' as const, cardId: `item_${index}`, title: `Relic ${index + 1}` })),
    },
}

export const NoOtherWorkspace: Story = {
    args: { destinations: [] },
}
