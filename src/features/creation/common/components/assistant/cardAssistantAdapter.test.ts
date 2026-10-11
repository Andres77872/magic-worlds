import { describe, expect, it } from 'vitest'
import type { AssistantCardDocument, AssistantCardType } from '@/shared/types/assistant.types'
import { cardAssistantAdapter } from './cardAssistantAdapter'

const TARGET_CAS = { revision: '2026-09-19T00:43:33', content_hash: 'a'.repeat(64) }
const PUBLISHED_REVISION = {
    latest_version_id: 'version-3', latest_version_number: 3, has_draft: false,
    draft_updated_at: null, draft_based_on_version_number: null,
}

function binding(cardType: AssistantCardType, targetId: string | null, current: Record<string, unknown> = { name: 'Unsaved name' }) {
    return { cardType, targetId, title: 'Untitled', current }
}

function saved(card: Record<string, unknown>): AssistantCardDocument {
    return card as unknown as AssistantCardDocument
}

describe('cardAssistantAdapter', () => {
    it('scopes conversations by card type, and by card once saved', () => {
        expect(cardAssistantAdapter.lifecycle).toBe('panel')
        expect(cardAssistantAdapter.scope(binding('world', null))).toEqual({ kind: 'card', card_type: 'world' })
        expect(cardAssistantAdapter.scope(binding('item', 'item-1'))).toEqual({ kind: 'card', card_type: 'item', card_id: 'item-1' })
        expect(cardAssistantAdapter.title(binding('world', null), 'Invent a world')).toBe('Untitled')
    })

    it('sends no current card for an unsaved form', () => {
        expect(cardAssistantAdapter.turnBody(binding('world', null), 'Invent a world', null))
            .toEqual({ kind: 'card', message: 'Invent a world', card_type: 'world', current: null })
    })

    it.each(['character', 'world', 'item'] as const)('sends server revision metadata and preserves unsaved %s fields', (cardType) => {
        const body = cardAssistantAdapter.turnBody(
            binding(cardType, 'card-1', { name: 'Unsaved name', category: null, place_type: 'country', is_draft: false }),
            'Refine this',
            { target: saved({ id: 'card-1', name: 'Saved name', ...PUBLISHED_REVISION, is_draft: false }), cas: TARGET_CAS },
        )
        expect(body).toEqual({
            kind: 'card', message: 'Refine this', card_type: cardType,
            current: { id: 'card-1', name: 'Unsaved name', category: null, ...PUBLISHED_REVISION },
            expected_revision: TARGET_CAS.revision, expected_content_hash: TARGET_CAS.content_hash,
        })
    })

    it('carries the private draft markers when the saved card has a draft', () => {
        const revision = { ...PUBLISHED_REVISION, has_draft: true, is_draft: true,
            draft_updated_at: '2026-09-19T00:45:00', draft_based_on_version_number: 3, based_on_version_number: 3 }
        const body = cardAssistantAdapter.turnBody(binding('world', 'world-1', { name: 'Glass' }), 'Edit',
            { target: saved({ id: 'world-1', ...revision }), cas: TARGET_CAS })
        expect(body.current).toEqual({ id: 'world-1', name: 'Glass', ...revision })
    })

    it('sends adventure concurrency values without versioned-card metadata', () => {
        const body = cardAssistantAdapter.turnBody(binding('adventure_template', 'adventure-1', { name: 'A quest' }), 'Add a twist',
            { target: null, cas: TARGET_CAS })
        expect(body).toEqual({
            kind: 'card', message: 'Add a twist', card_type: 'adventure_template', current: { id: 'adventure-1', name: 'A quest' },
            expected_revision: TARGET_CAS.revision, expected_content_hash: TARGET_CAS.content_hash,
        })
    })

    it('refuses a bound turn whose saved snapshot has no revision metadata', () => {
        expect(() => cardAssistantAdapter.turnBody(binding('world', 'world-1'), 'Edit',
            { target: saved({ id: 'world-1', name: 'Glass' }), cas: TARGET_CAS })).toThrow('Missing card assistant revision metadata')
    })
})
