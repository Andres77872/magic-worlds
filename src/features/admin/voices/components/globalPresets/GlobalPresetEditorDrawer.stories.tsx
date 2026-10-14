import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { installPlayAdminAuditApi } from '@/features/admin/playAdminAuditFixtures'
import { auditGlobalPresets } from '../../fixtures'
import { VoiceConsoleProvider } from '../shell/VoiceConsoleContext'
import { GlobalPresetEditorDrawer } from './GlobalPresetEditorDrawer'

const [publicPreset, notPublicPreset] = auditGlobalPresets.items

const meta = {
    title: 'Admin/Voices/GlobalPresetEditorDrawer',
    component: GlobalPresetEditorDrawer,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The preset editor in "global" mode: name, description, a catalog voice, a language the voice lists, an emotion and all five voice settings. A warning shows when users could not apply the preset. The rules run before the write; saving fails locally in this offline preview.',
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
        preset: { control: false, description: 'The row to edit; omitted to create one.' },
        onClose: { action: 'closed', control: false },
        onSaved: { action: 'saved', control: false },
    },
    args: {
        preset: null,
        onClose: fn(),
        onSaved: fn(),
    },
} satisfies Meta<typeof GlobalPresetEditorDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}
export const Edit: Story = { args: { preset: publicPreset } }
export const NotPublicVoice: Story = { args: { preset: notPublicPreset } }
