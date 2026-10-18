import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import type { CardSourceStatus } from '@/shared/types/workspace.types'
import { cardSourceStatusText } from './cardSourceStatus'

const source: CardSourceStatus = { card_type: 'character', card_id: 'c1', available: true,
    latest_version_id: 'v5', latest_version_number: 5, has_draft: false }
const snapshot = { source_card_version_id: 'v3', source_card_version_number: 3 }

describe('frozen card source status', () => {
    it('distinguishes matching, older, unavailable and unchecked sources', () => {
        expect(cardSourceStatusText('character', snapshot, source, 'ready', i18n.t)).toBe('Using v3 · Older version · Latest saved version v5')
        expect(cardSourceStatusText('character', { source_card_version_number: 5, source_card_version_id: 'v5' }, source, 'ready', i18n.t)).toBe('Using v5 · Latest saved version')
        expect(cardSourceStatusText('character', snapshot, { ...source, available: false, latest_version_id: null, latest_version_number: null }, 'ready', i18n.t)).toBe('Using v3 · Source unavailable')
        expect(cardSourceStatusText('character', snapshot, undefined, 'unchecked', i18n.t)).toBe('Using v3 · Source not checked')
        expect(cardSourceStatusText('character', snapshot, undefined, 'failed', i18n.t)).toContain('Source check failed')
    })

    it('keeps draft changes separate and does not claim that inconsistent pins are current', () => {
        expect(cardSourceStatusText('character', snapshot, { ...source, has_draft: true }, 'ready', i18n.t)).toContain('Unpublished changes')
        for (const pin of [{ source_card_version_number: 6 }, { source_card_version_number: 5, source_card_version_id: 'different' }, {}]) {
            expect(cardSourceStatusText('character', pin, source, 'ready', i18n.t)).toContain('could not be verified')
        }
        expect(cardSourceStatusText('character', { source_card_version_number: 0 }, { ...source, latest_version_number: 0, latest_version_id: null }, 'ready', i18n.t)).toBe('No saved version')
        expect(cardSourceStatusText('adventure_template', {}, source, 'ready', i18n.t)).toBe('Version not tracked')
    })
})
