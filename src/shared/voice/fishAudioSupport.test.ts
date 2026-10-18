import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { describe, expect, it } from 'vitest'
import type { FishVoicePreset, CatalogVoice } from '@/shared'
import contract from './fishAudioContract.fixture.json'
import { parseStoredVoice, keepStoredVoice } from './parseStoredVoice'
import { surfaceCapabilitiesFor, toVoiceCapabilities } from './voiceCapabilities'
import { readEffectiveVoice } from './effectiveVoice'
import { catalogQueryString, toCatalogVoice } from './voiceCatalog'
import { voiceFromPreset } from '@/features/voices/voiceFromPreset'
import { voiceFromCatalog } from '@/features/voices/voiceFromCatalog'
import { previewRequestBody } from '@/features/voices/useRecipePreview'

describe('Fish voice contract 3', () => {
    it('accepts calls only when the native call operation and healthy profile are explicit', () => {
        const enabled = structuredClone(contract.capabilities)
        const fish = enabled.providers.find((provider) => provider.provider === 'fish_audio')!
        const native = { ...fish, operations: [...fish.operations, 'call'],
            surfaces: { ...fish.surfaces, call: fish.surfaces.narration } }
        const caps = toVoiceCapabilities({ ...enabled, consent_version_required: 'voice-v3',
            providers: enabled.providers.map((provider) => provider.provider === 'fish_audio' ? native : provider) })!
        expect(surfaceCapabilitiesFor(caps, 'call', 'standard', 'fish_audio')?.healthy).toBe(true)
        expect(caps.consent_version_required).toBe('voice-v3')
    })
    it('reads stored voices losslessly and copies provider identity through assignments', () => {
        expect(parseStoredVoice(contract.stored)).toBe(contract.stored)
        expect(voiceFromPreset(contract.preset as FishVoicePreset)).toMatchObject(contract.stored)
        expect(voiceFromCatalog({ voice_key: contract.stored.voice_key, display_name: 'Lantern', provider: 'fish_audio' })).toMatchObject({ schema_version: 3, provider: 'fish_audio' })
        const unknown = { ...contract.stored, schema_version: 4, settings: { future_control: true } }
        expect(parseStoredVoice(unknown)).toBeNull()
        expect(keepStoredVoice(unknown)).toBe(unknown)
    })

    it('keeps Fish controls separate and refuses missing/unknown health and calls', () => {
        const caps = toVoiceCapabilities(contract.capabilities)
        const surface = surfaceCapabilitiesFor(caps, 'preview', 'standard', 'fish_audio')
        expect(surface).toMatchObject({ controls: [], supports_emotion: true, supports_speed: false, healthy: true })
        expect(surfaceCapabilitiesFor(caps, 'call', 'standard', 'fish_audio')).toBeNull()
        const missing = structuredClone(contract.capabilities)
        delete (missing.providers[0].surfaces.preview.standard as { healthy?: boolean }).healthy
        expect(surfaceCapabilitiesFor(toVoiceCapabilities(missing), 'preview', 'standard', 'fish_audio')?.healthy).toBe(false)
        expect(surfaceCapabilitiesFor(toVoiceCapabilities({ surfaces: {} }), 'preview', 'standard', 'fish_audio')).toBeNull()
        expect(surfaceCapabilitiesFor(toVoiceCapabilities({ ...contract.capabilities, providers: [{ provider: 'future' }] }), 'preview', 'standard', 'fish_audio')).toBeNull()
    })

    it('preserves catalog/projection metadata and rejects unknown catalog providers', () => {
        const item = toCatalogVoice({ voice_key: contract.stored.voice_key, display_name: 'Lantern', provider: 'fish_audio', profile_id: 'fish_drama_3' }) as CatalogVoice
        expect(item.provider).toBe('fish_audio')
        expect(readEffectiveVoice({ provider_route: 'fish_audio', display_name: 'Lantern' })?.provider_route).toBe('fish_audio')
        expect(toCatalogVoice({ ...item, provider: 'unknown' })).toBeNull()
        expect(catalogQueryString({ provider: 'fish_audio' })).toContain('provider=fish_audio')
    })

    it('uses the negotiated recipe envelope for fixed-text Fish previews', () => {
        expect(previewRequestBody({ provider: 'fish_audio', voiceKey: contract.stored.voice_key, settings: null, emotion: 'calm', textId: 'dialogue', language: 'en', tier: 'standard' })).toEqual({
            schema_version: 3, provider: 'fish_audio', voice_key: contract.stored.voice_key, settings: null,
            emotion: 'calm', text_id: 'dialogue', language: 'en', tier: 'standard',
        })
    })
})
