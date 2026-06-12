import { describe, expect, it } from 'vitest'
import type { Adventure } from '@/shared'
import { toScene } from './sceneModel'

describe('sceneModel', () => {
    it('hides one-character scratch data from adventure scenes', () => {
        const scene = toScene({
            id: 'a1',
            scenario: 'a',
            triggers: ['x', 'ember path'],
            category: [{ name: 'z' }],
            world: { id: 'w1', name: 'w', type: 'c', details: {} },
            persona: { id: 'p1', name: '', race: 'h', stats: {} },
            characters: [],
            turns: [],
        } as Adventure)

        expect(scene.title).toBe('Untitled adventure')
        expect(scene.location).toBeUndefined()
        expect(scene.description).toBe('A scene waiting to begin.')
        expect(scene.tags).toEqual(['ember path'])
    })
})
