import type { Meta, StoryObj } from '@storybook/react-vite'
import { installPlayAdminAuditApi, type AuditState } from '@/features/admin/playAdminAuditFixtures'
import { VoiceConsoleProvider } from '../shell/VoiceConsoleContext'
import { GlobalPresetsModule } from './GlobalPresetsModule'

/** `state` picks the offline API answers (installed in `beforeEach`). */
function GlobalPresetsScene({ state }: { state: AuditState }) {
    return (
        <div data-audit-state={state}>
            <VoiceConsoleProvider initialModule="globalPresets">
                <GlobalPresetsModule />
            </VoiceConsoleProvider>
        </div>
    )
}

const meta = {
    title: 'Admin/Voices/GlobalPresetsModule',
    component: GlobalPresetsScene,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Root global presets (05 §8.12): presets every user can apply, created and edited in a drawer and deleted behind a confirm. A warning badge marks presets users could not apply (voice not public, or not active). Every API method is replaced offline; writes fail locally.',
            },
        },
    },
    beforeEach: ({ args }) => installPlayAdminAuditApi(args.state),
    argTypes: {
        state: { control: 'inline-radio', options: ['populated', 'empty', 'loading', 'error'] },
    },
    args: { state: 'populated' },
} satisfies Meta<typeof GlobalPresetsScene>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {}
export const Empty: Story = { args: { state: 'empty' } }
export const Loading: Story = { args: { state: 'loading' } }
export const LoadError: Story = { args: { state: 'error' } }
