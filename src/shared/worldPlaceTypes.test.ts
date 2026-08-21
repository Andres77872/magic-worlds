import { describe, expect, it } from 'vitest'
import { readWorldPlaceType, withWorldPlaceType } from './worldPlaceTypes'

describe('world place type category contract', () => {
    it('reads place scale only from the stored Setting category', () => {
        expect(readWorldPlaceType({
            category: [{ name: 'Setting', attributes: [{ 'Place type': 'city' }] }],
        })).toBe('city')
        expect(readWorldPlaceType({ category: [] })).toBe('world')
    })

    it('upserts the stored attribute without discarding other category data', () => {
        const result = withWorldPlaceType([
            { name: 'Setting', description: 'Scale and genre.', attributes: [{ Climate: 'dry' }, { 'Place type': 'region' }] },
            { name: 'Secrets', attributes: [{ Truth: 'buried' }] },
        ], 'city')

        expect(readWorldPlaceType({ category: result })).toBe('city')
        expect(result[0].attributes).toContainEqual({ Climate: 'dry' })
        expect(result[1].attributes).toContainEqual({ Truth: 'buried' })
    })
})
