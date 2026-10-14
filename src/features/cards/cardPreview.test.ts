import { describe, expect, it, vi } from 'vitest'
import type { Character, EffectiveVoice } from '@/shared'
import { findLocalCardPreview } from './cardPreview'

vi.mock('@/infrastructure/api', () => ({
    apiService: {},
    resolveMediaUrl: (url?: string | null) => url ?? undefined,
}))

const EFFECTIVE: EffectiveVoice = {
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    display_name: 'Eldrin',
    provider_route: 'elevenlabs',
    substitution_reason: null,
    badges: [],
}
const VOICE = { schema_version: 2 as const, provider: 'elevenlabs' as const, voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f', voice_name: 'Eldrin', preset_name: 'Child girl' }

function library(characters: Character[]) {
    return { characters, worlds: [], items: [], templateAdventures: [] }
}

describe('card preview voice (R1-FE-03, D38)', () => {
    it('carries a character card’s stored voice and projection', () => {
        const card: Character = { id: 'c1', name: 'Lyra', race: 'Elf', description: '', stats: {}, voice: VOICE, effective_voice: EFFECTIVE }
        expect(findLocalCardPreview(library([card]), { type: 'character', id: 'c1' })?.voice).toEqual({ stored: VOICE, effective: EFFECTIVE })
    })

    it('never for a persona, and not without a projection', () => {
        const persona: Character = { id: 'p1', name: 'Me', race: 'Human', description: '', stats: {}, role: 'persona', voice: VOICE, effective_voice: EFFECTIVE }
        const plain: Character = { id: 'c2', name: 'Dorn', race: 'Dwarf', description: '', stats: {}, voice: VOICE }
        const lib = library([persona, plain])
        expect(findLocalCardPreview(lib, { type: 'persona', id: 'p1' })).not.toHaveProperty('voice')
        expect(findLocalCardPreview(lib, { type: 'character', id: 'p1' })).not.toHaveProperty('voice')
        expect(findLocalCardPreview(lib, { type: 'character', id: 'c2' })).not.toHaveProperty('voice')
    })
})
