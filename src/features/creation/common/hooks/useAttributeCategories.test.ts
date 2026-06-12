import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { useAttributeCategories } from './useAttributeCategories'

const DEFAULTS: AttributeCategory[] = [{ id: 'stats', name: 'Stats', type: 'stat', description: '' }]

describe('useAttributeCategories', () => {
    it('expands multi-key attribute objects into one row per key/value', () => {
        // AI-generated cards return objects with MORE than one key/value pair.
        const entity = {
            category: [{ name: 'Stats', attributes: [{ element: 'arcane', focus: 'evocation' }] }],
        }
        const { result } = renderHook(() => useAttributeCategories({ defaults: DEFAULTS, entity }))

        expect(result.current.attributes['stats']).toEqual([
            { key: 'element', value: 'arcane' },
            { key: 'focus', value: 'evocation' },
        ])
    })

    it('hydrateFrom replaces categories + values after mount (defaults matched by name)', () => {
        const { result } = renderHook(() => useAttributeCategories({ defaults: DEFAULTS }))
        expect(result.current.attributes['stats']).toEqual([])

        act(() => {
            result.current.hydrateFrom({
                category: [
                    { name: 'Stats', attributes: [{ Agility: '8' }] },
                    { name: 'Lore', description: 'Background', attributes: [{ origin: 'north', clan: 'frost' }] },
                ],
            })
        })

        // The matching default keeps its id and receives the rows…
        expect(result.current.attributes['stats']).toEqual([{ key: 'Agility', value: '8' }])
        // …and an unrecognized category is added as a custom group with all its rows.
        const lore = result.current.customCategories.find((c) => c.name === 'Lore')
        expect(lore).toBeDefined()
        expect(result.current.attributes[lore!.id]).toEqual([
            { key: 'origin', value: 'north' },
            { key: 'clan', value: 'frost' },
        ])
    })
})
