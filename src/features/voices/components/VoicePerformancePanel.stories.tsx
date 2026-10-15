import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { apiService } from '@/infrastructure/api'
import type { VoicePerformance } from '@/shared'
import { installVoiceStoryApi } from '../storybook/voiceStoryApi'
import { PERFORMANCE_CAPABILITIES, PRONUNCIATION_FIXTURE } from '../performanceFixtures'
import { VoicePerformancePanel } from './VoicePerformancePanel'

function Scene({ language }: { language: 'en' | 'es' }) {
    const [value, setValue] = useState<VoicePerformance | null>({ version: 1, direction: 'warm and quietly reassuring', dictionary_refs: [] })
    return <VoicePerformancePanel voiceKey={`vk_${'a'.repeat(32)}`} language={language} emotion={null} value={value} onChange={setValue} />
}

const meta = {
    title: 'Voices/VoicePerformancePanel', component: Scene, tags: ['autodocs'], args: { language: 'en' },
    parameters: { layout: 'padded', docs: { description: { component: 'Optional phrase delivery, positioned reactions, pinned pronunciation versions and metered comparison. Provider controls stay out of the text. All APIs use offline fixtures.' } } },
    beforeEach: () => {
        const restore = installVoiceStoryApi()
        apiService.getVoicePerformanceCapabilities = async () => PERFORMANCE_CAPABILITIES
        apiService.listPronunciationDictionaries = async () => ({ items: [PRONUNCIATION_FIXTURE] })
        apiService.savePronunciationDictionary = async body => ({ ...PRONUNCIATION_FIXTURE, ...body, version_id: `pv_${'d'.repeat(32)}` })
        apiService.archivePronunciationDictionary = async () => {}
        return restore
    },
} satisfies Meta<typeof Scene>
export default meta
type Story = StoryObj<typeof meta>
export const English: Story = {}
export const Spanish: Story = { args: { language: 'es' } }
