import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { apiService } from '@/infrastructure/api'
import { FishInventoryPanel } from './FishInventoryPanel'

const meta = {
    title: 'Admin/Voices/FishInventoryPanel',
    component: FishInventoryPanel,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: { description: { component: 'Import owned or licensed Fish references as drafts, with an explicit rights review before acceptance and publication.' } },
    },
    args: { onImported: fn() },
    beforeEach: () => {
        const inventory = apiService.getFishInventory
        const references = apiService.getFishReferences
        const save = apiService.importFishReference
        apiService.getFishInventory = async () => ({ provider: 'fish_audio', operations: ['import'], items: [
            { provider_voice_id: 'a'.repeat(32), display_name: 'Lantern keeper', languages: ['en'], licensed: false, available: true },
        ] })
        apiService.getFishReferences = async (language, query) => ({ provider: 'fish_audio', operations: ['import'], total: 2, next_page: null,
            items: (language === 'es' ? [
                { provider_voice_id: 'c'.repeat(32), display_name: 'Gabriel' },
                { provider_voice_id: 'd'.repeat(32), display_name: 'Serena' },
            ] : [
                { provider_voice_id: 'e'.repeat(32), display_name: 'Dave' },
                { provider_voice_id: 'f'.repeat(32), display_name: 'Sofiah' },
            ]).filter((item) => !query || item.display_name.toLowerCase().includes(query.toLowerCase()))
                .map((item) => ({ ...item, languages: [language], licensed: true, available: true })),
        })
        apiService.importFishReference = async () => ({ voice_key: 'vk_' + 'b'.repeat(32) })
        return () => { apiService.getFishInventory = inventory; apiService.getFishReferences = references; apiService.importFishReference = save }
    },
} satisfies Meta<typeof FishInventoryPanel>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
