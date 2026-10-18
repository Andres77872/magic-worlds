import { describe, expect, it } from 'vitest'
import { isCardSourceStatusList } from './cardSourceStatusContract'

const cards = [{ card_type: 'character' as const, card_id: 'c1' }]
const head = { ...cards[0], available: true, latest_version_id: 'v1', latest_version_number: 1, has_draft: false }

describe('source status transport', () => {
    it('accepts exact source heads and explicit unavailable results', () => {
        expect(isCardSourceStatusList({ items: [head] }, cards)).toBe(true)
        expect(isCardSourceStatusList({ items: [{ ...head, available: false, latest_version_id: null, latest_version_number: null, has_draft: null }] }, cards)).toBe(true)
    })
    it('rejects missing, duplicate, foreign and inconsistent statuses', () => {
        for (const items of [[], [head, head], [{ ...head, card_id: 'foreign' }],
            [{ ...head, available: false }], [{ ...head, latest_version_number: 0 }], [{ ...head, has_draft: null }]]) {
            expect(isCardSourceStatusList({ items }, cards)).toBe(false)
        }
    })
})
