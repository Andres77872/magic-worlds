import { describe, expect, it } from 'vitest'
import { asArray, transformCharacters, transformTemplates, transformWorlds } from './cardTransforms'

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
        expect(transformTemplates(null)).toEqual([])
    })

    it('maps raw character rows, defaulting race and triggers', () => {
        const [char] = transformCharacters([{ uuid: 'c1', name: 'Lyra' }])
        expect(char.id).toBe('c1')
        expect(char.race).toBe('')
        expect(char.triggers).toEqual([])
        expect(char.stats).toEqual({})
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
})
