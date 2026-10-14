import { describe, expect, it } from 'vitest'
import { catalogKeyBatches, catalogQueryString, toCatalogItems, toCatalogPage, toCatalogVoice } from './voiceCatalog'

/** 03 §5.12 item, verbatim shape. */
const ITEM = {
    voice_key: 'vk_3f0c2a9e5b7d4c1a8e6f0b2d4a6c8e1f',
    display_name: 'Eldrin',
    description: 'A weathered storyteller.',
    gender: 'male', age: 'old', accent: 'british',
    primary_language: 'en',
    languages: [
        { language: 'en', native: true, accent: 'british', accepted_models: ['standard', 'expressive'], sample_url: '/voices/catalog/vk_x/preview.mp3?lang=en&tier=standard&h=1' },
        { language: 'es', native: false, accent: null, accepted_models: ['standard', 'eleven_flash_v2_5'], sample_url: '/voices/catalog/vk_x/preview.mp3?lang=es&tier=standard&h=2' },
    ],
    tags: ['narrator', 'mentor'],
    house_voice: true,
    call_eligible: true,
    status: 'active',
    disable_at: null,
    locked: false, min_plan: null,
    replacement: null,
}

describe('catalog readers', () => {
    it('reads a 03 §5.12 item, keeping tier names only', () => {
        const voice = toCatalogVoice(ITEM)!
        expect(voice.voice_key).toBe(ITEM.voice_key)
        expect(voice.languages[1].accepted_models).toEqual(['standard'])
        expect(voice).toMatchObject({ house_voice: true, call_eligible: true, status: 'active', locked: false, min_plan: null, replacement: null })
    })

    it('defaults missing optional fields and drops rows without a key or name', () => {
        expect(toCatalogVoice({ voice_key: 'vk_a', display_name: 'Ana' })).toEqual({
            voice_key: 'vk_a', display_name: 'Ana', description: null, gender: null, age: null, accent: null,
            primary_language: '', languages: [], tags: [], house_voice: false, call_eligible: false, status: 'active',
            disable_at: null, locked: false, min_plan: null, replacement: null,
        })
        expect(toCatalogVoice({ display_name: 'No key' })).toBeNull()
        expect(toCatalogVoice({ voice_key: 'vk_b' })).toBeNull()
        expect(toCatalogVoice('vk_c')).toBeNull()
    })

    it('reads a deprecating voice with its replacement', () => {
        const voice = toCatalogVoice({ ...ITEM, status: 'deprecating', disable_at: '2026-12-01', replacement: { voice_key: 'vk_r', display_name: 'Rowan' } })!
        expect(voice.status).toBe('deprecating')
        expect(voice.replacement).toEqual({ voice_key: 'vk_r', display_name: 'Rowan' })
    })

    it('reads pages and batch bodies', () => {
        expect(toCatalogPage({ items: [ITEM, { bad: true }], next_cursor: 'c2' })).toEqual({ items: [toCatalogVoice(ITEM)], next_cursor: 'c2' })
        expect(toCatalogPage({ items: [] })).toEqual({ items: [], next_cursor: null })
        expect(toCatalogItems({ detail: 'Not Found' })).toEqual([])
        expect(toCatalogItems(null)).toEqual([])
    })
})

describe('catalogQueryString', () => {
    it('encodes the 03 §5.12 filters and the cursor, skipping blanks', () => {
        const query = catalogQueryString({
            language: 'es', accent: ' ', gender: 'female', tags: ['narrator', ' ', 'villain'], works_in_calls: true,
            q: 'old sage', include_locked: false, limit: 500,
        }, 'cursor-2')
        expect(query).toBe('?language=es&gender=female&tags=narrator%2Cvillain&works_in_calls=true&q=old+sage&include_locked=false&after=cursor-2&limit=50')
        expect(catalogQueryString()).toBe('')
    })

    it('splits key lookups into batches of at most 100 distinct keys', () => {
        const keys = Array.from({ length: 205 }, (_, index) => `vk_${index}`)
        const batches = catalogKeyBatches([...keys, 'vk_0', ' ', ''])
        expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5])
        expect(batches.flat()).toEqual(keys)
    })
})
