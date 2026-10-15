import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { installPlayAdminAuditApi } from '@/features/admin/playAdminAuditFixtures'
import { apiService } from '@/infrastructure/api'
import { auditDesign, draftVoice } from '../../fixtures'
import { VoiceConsoleProvider } from '../shell/VoiceConsoleContext'
import { VoiceDesignPanel } from './VoiceDesignPanel'

function DesignScene({ language, available }: { language: 'en' | 'es'; available: boolean }) {
    return <div data-design-language={language} data-design-available={available}>
        <VoiceConsoleProvider initialModule="create"><VoiceDesignPanel /></VoiceConsoleProvider>
    </div>
}

const meta = {
    title: 'Admin/Voices/VoiceDesignPanel',
    component: DesignScene,
    tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Root voice creation with provider-specific controls, English/Spanish Fish auditions and signed private persistence. All API calls are offline fixtures.' } } },
    args: { language: 'en', available: true },
    beforeEach: ({ args }) => {
        const restore = installPlayAdminAuditApi('populated')
        apiService.getFishDesignCapabilities = async () => ({ provider: 'fish_audio', available: args.available, languages: ['en', 'es'],
            model_id: 'voice-design-1', max_text_chars: 150, max_candidates: 4, request_price_usd_micros: 10000 })
        apiService.designFishVoice = async (body) => ({ provider: 'fish_audio', text: body.text,
            previews: auditDesign.previews.slice(0, body.candidate_count).map((preview) => ({ ...preview, language: body.language, save_supported: true })),
        })
        apiService.saveFishDesign = async (body) => ({ ...draftVoice, provider: 'fish_audio', provider_voice_id: 'fish-design-fixture',
            display_name: body.voice_name, primary_language: body.labels.language, call_eligible: false, default_settings: null, acceptance: [] })
        return restore
    },
    play: async ({ canvasElement, args }) => {
        const canvas = within(canvasElement)
        await userEvent.click(within(canvas.getByRole('group', { name: 'Voice provider' })).getByRole('button', { name: 'Fish Audio' }))
        if (args.language === 'es') {
            await userEvent.click(canvas.getByRole('combobox', { name: 'Design language' }))
            await userEvent.click(within(document.body).getByRole('option', { name: 'Español' }))
        }
    },
} satisfies Meta<typeof DesignScene>

export default meta
type Story = StoryObj<typeof meta>
export const English: Story = {}
export const Spanish: Story = { args: { language: 'es' } }
export const Unavailable: Story = { args: { available: false } }
