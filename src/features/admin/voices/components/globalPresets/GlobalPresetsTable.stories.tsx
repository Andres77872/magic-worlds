import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { installPlayAdminAuditApi } from '@/features/admin/playAdminAuditFixtures'
import { auditGlobalPresets } from '../../fixtures'
import { VoiceConsoleProvider } from '../shell/VoiceConsoleContext'
import { GlobalPresetsTable } from './GlobalPresetsTable'

const meta = {
    title: 'Admin/Voices/GlobalPresetsTable',
    component: GlobalPresetsTable,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'The global preset list: each V2 preset with its voice, language, seed key and state ("Not public", or the catalog status when the voice is not active), with Edit and Delete. A stored V1 row is labelled "Legacy" and "Hidden from users", and offers no action.',
            },
        },
    },
    beforeEach: () => installPlayAdminAuditApi('populated'),
    decorators: [
        (Story) => (
            <VoiceConsoleProvider initialModule="globalPresets">
                <Story />
            </VoiceConsoleProvider>
        ),
    ],
    argTypes: {
        onEdit: { action: 'edit', control: false },
        onDelete: { action: 'delete', control: false },
        rows: { control: false },
    },
    args: {
        rows: auditGlobalPresets.items,
        onEdit: fn(),
        onDelete: fn(),
    },
} satisfies Meta<typeof GlobalPresetsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Mixed: Story = {}
export const LegacyOnly: Story = { args: { rows: auditGlobalPresets.items.slice(2) } }
