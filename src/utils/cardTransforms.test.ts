import { describe, expect, it } from 'vitest'
import { asArray, transformCharacters, transformItems, transformTemplates, transformWorlds } from './cardTransforms'

describe('cardTransforms', () => {
    it('asArray guards non-array inputs (terminal auth expiry degrades GETs to {})', () => {
        expect(asArray({})).toEqual([])
        expect(asArray(undefined)).toEqual([])
        expect(asArray(null)).toEqual([])
        expect(asArray([1])).toEqual([1])
    })

    it('transforms tolerate non-array input without throwing', () => {
        expect(transformCharacters({})).toEqual([])
        expect(transformWorlds(undefined)).toEqual([])
        expect(transformItems(undefined)).toEqual([])
        expect(transformTemplates(null)).toEqual([])
    })

    it('maps raw character rows, defaulting race and triggers', () => {
        const [char] = transformCharacters([{ uuid: 'c1', name: 'Lyra' }])
        expect(char.id).toBe('c1')
        expect(char.race).toBe('')
        expect(char.triggers).toEqual([])
        expect(char.stats).toEqual({})
        expect(char.role).toBe('character')
        expect(char.is_default_persona).toBe(false)
    })

    it('preserves persona role and default persona metadata', () => {
        const [char] = transformCharacters([
            { id: 'p1', name: 'Aria', role: 'persona', is_default_persona: true },
        ])
        expect(char.role).toBe('persona')
        expect(char.is_default_persona).toBe(true)
    })

    it('maps world place type independently from genre type', () => {
        const [world, fallback] = transformWorlds([
            { id: 'w1', name: 'Sunspire', placeType: 'city', type: 'fantasy' },
            { id: 'w2', name: 'Old Marches', type: 'low magic' },
        ])
        expect(world.place_type).toBe('city')
        expect(world.type).toBe('fantasy')
        expect(fallback.place_type).toBe('world')
    })

    it('maps template scenario from description, falling back to name', () => {
        const [withDescription, nameOnly] = transformTemplates([
            { id: 't1', name: 'Ring Quest', description: 'Destroy the ring' },
            { id: 't2', name: 'Ring Quest' },
        ])
        expect(withDescription.scenario).toBe('Destroy the ring')
        expect(nameOnly.scenario).toBe('Ring Quest')
    })

    it('lifts the first world of a template into `world`', () => {
        const [template] = transformTemplates([
            { id: 't1', name: 'Quest', world: [{ id: 'w1', name: 'Mordor' }] },
        ])
        expect(template.world).toEqual({ id: 'w1', name: 'Mordor' })
    })

    it('maps item-specific fields from raw rows', () => {
        const [item] = transformItems([
            {
                uuid: 'i1',
                name: 'Moonlit Compass',
                type: 'relic',
                rarity: 'rare',
                description: 'Finds safe roads.',
                effects: ['Reveals hidden paths'],
                requirements: ['Moonlight'],
                limitations: ['Fails underground'],
                triggers: ['compass'],
            },
        ])
        expect(item.id).toBe('i1')
        expect(item.type).toBe('relic')
        expect(item.rarity).toBe('rare')
        expect(item.effects).toEqual(['Reveals hidden paths'])
        expect(item.requirements).toEqual(['Moonlight'])
        expect(item.limitations).toEqual(['Fails underground'])
        expect(item.triggers).toEqual(['compass'])
    })
})
