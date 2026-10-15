/** Shared Fish contract fixtures for stories and behavior tests only. */
import type { CatalogVoice, FishVoicePreset, VoiceCapabilities } from '@/shared'
import contract from '@/shared/voice/fishAudioContract.fixture.json'
import { toVoiceCapabilities } from '@/shared/voice/voiceCapabilities'
import { CAPABILITIES_EL_PLUS, catalogVoice } from './fixtures'

export const PRESET_FISH = contract.preset as FishVoicePreset
export const CATALOG_FISH: CatalogVoice = catalogVoice({
    voice_key: PRESET_FISH.voice_key, display_name: 'Lantern', provider: 'fish_audio', profile_id: 'fish_drama_3',
    call_eligible: false, primary_language: 'en', house_voice: false,
    languages: [{ language: 'en', native: true, accent: null, accepted_models: ['standard'], sample_url: '' }],
})
export const CAPABILITIES_FISH: VoiceCapabilities = {
    ...CAPABILITIES_EL_PLUS, contract_version: 3, providers: toVoiceCapabilities(contract.capabilities)!.providers,
}
