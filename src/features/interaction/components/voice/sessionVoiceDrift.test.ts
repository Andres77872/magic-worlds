import { describe, expect, it } from 'vitest'
import type { EffectiveVoice } from '@/shared/types'
import { castVoiceDrift, MAX_REFRESH_CARD_IDS, refreshBatches, sessionVoiceDrift } from './sessionVoiceDrift'

const KEY_A = `vk_${'a'.repeat(32)}`
const KEY_B = `vk_${'b'.repeat(32)}`

function el(voiceKey: string | null, overrides: Partial<EffectiveVoice> = {}): EffectiveVoice {
    return {
        voice_key: voiceKey,
        display_name: voiceKey === KEY_A ? 'Aria' : 'Bram',
        provider_route: 'elevenlabs',
        substitution_reason: null,
        badges: [],
        ...overrides,
    }
}

/** A wire projection on a route this client does not know: read as no projection. */
const unknownRoute = { ...el(null), display_name: 'Calm narrator', provider_route: 'other' }

describe('sessionVoiceDrift (D36)', () => {
    it('is nothing without a session projection', () => {
        expect(sessionVoiceDrift(undefined, el(KEY_B))).toBeNull()
        expect(sessionVoiceDrift(null, el(KEY_B))).toBeNull()
        expect(sessionVoiceDrift(unknownRoute, el(KEY_B))).toBeNull()
    })

    it('differs when the card now plays another voice', () => {
        expect(sessionVoiceDrift(el(KEY_A), el(KEY_B))).toEqual({ replaced: false, differs: true, sessionName: 'Aria', cardName: 'Bram' })
    })

    it('is nothing when the session plays what the card plays', () => {
        expect(sessionVoiceDrift(el(KEY_A), el(KEY_A))).toBeNull()
    })

    it('flags a replacement by reason or badge; without a different card voice there is no action', () => {
        const byReason = sessionVoiceDrift(el(KEY_A, { substitution_reason: 'voice_removed' }), el(KEY_A))
        expect(byReason).toEqual({ replaced: true, differs: false, sessionName: 'Aria', cardName: 'Aria' })
        const byBadge = sessionVoiceDrift(el(KEY_A, { badges: ['replaced'] }), null)
        expect(byBadge).toMatchObject({ replaced: true, differs: false, cardName: null })
        expect(sessionVoiceDrift(el(KEY_A, { substitution_reason: 'voice_unavailable' }), el(KEY_B))).toMatchObject({ replaced: true, differs: true })
    })

    it('never offers the refresh for a missing card voice (source absent, D39 item 6)', () => {
        expect(sessionVoiceDrift(el(KEY_A), null)).toBeNull()
        expect(sessionVoiceDrift(el(KEY_A), unknownRoute)).toBeNull()
        expect(sessionVoiceDrift(el(KEY_A), el(null))).toBeNull()
    })

    const notCopyableCards: Array<[string, Partial<EffectiveVoice>]> = [
        ['voice_removed', { substitution_reason: 'voice_removed', badges: ['replaced'] }],
        ['voice_blocked', { substitution_reason: 'voice_blocked' }],
        ['voice_unavailable', { substitution_reason: 'voice_unavailable' }],
        ['default_voice (unreadable)', { substitution_reason: 'default_voice' }],
        ['needs_reselect', { badges: ['needs_reselect'] }],
        ['retired (hidden)', { badges: ['retired'] }],
        ['leaving (deprecating, not active)', { badges: ['leaving'] }],
    ]

    it.each(notCopyableCards)('offers no refresh when the card’s own voice cannot be copied: %s (R-9, voice_not_eligible)', (_label, card) => {
        const cardVoice = el(KEY_B, card)
        expect(sessionVoiceDrift(el(KEY_A), cardVoice)).toBeNull()
        // A replaced session voice still shows, without the action.
        expect(sessionVoiceDrift(el(KEY_A, { substitution_reason: 'voice_removed', badges: ['replaced'] }), cardVoice))
            .toMatchObject({ replaced: true, differs: false })
        // The adventure cast list leaves such a member out too.
        expect(castVoiceDrift([{ cardId: 'c1', name: 'Lyra', effective: el(KEY_A) }], () => cardVoice)).toEqual([])
    })

    it('still offers the refresh for an eligible card voice with a language or tier substitution', () => {
        expect(sessionVoiceDrift(el(KEY_A), el(KEY_B, { substitution_reason: 'language_unsupported', badges: ['replaced'] })))
            .toMatchObject({ differs: true })
        expect(sessionVoiceDrift(el(KEY_A), el(KEY_B, { substitution_reason: 'tier_fallback', badges: ['standard_fallback'] })))
            .toMatchObject({ differs: true })
    })

    it('ignores the D33 distinct-voice substitution and non-replacement reasons', () => {
        expect(sessionVoiceDrift(el(KEY_A, { substitution_reason: 'distinct_voice' }), el(KEY_B))).toBeNull()
        expect(sessionVoiceDrift(el(KEY_A, { substitution_reason: 'tier_fallback' }), el(KEY_A))).toBeNull()
        expect(sessionVoiceDrift(el(KEY_A, { substitution_reason: 'default_voice' }), el(KEY_A))).toBeNull()
    })
})

describe('castVoiceDrift', () => {
    it('lists only refreshable members, deduplicated, in cast order', () => {
        const library: Record<string, unknown> = { c1: el(KEY_B), c2: el(KEY_A), c3: el(KEY_A) }
        const drift = castVoiceDrift(
            [
                { cardId: 'c1', name: 'Lyra', effective: el(KEY_A, { badges: ['replaced'], substitution_reason: 'voice_removed' }) },
                { cardId: 'c2', name: 'Mirren', effective: el(KEY_A) },
                { cardId: 'c3', name: 'Tess', effective: el(KEY_B) },
                { cardId: 'c3', name: 'Tess again', effective: el(KEY_B) },
                { cardId: null, name: 'Nameless', effective: el(KEY_B) },
                { cardId: 'c4', name: 'Ghost', effective: el(KEY_B) },
            ],
            (cardId) => library[cardId],
        )
        expect(drift.map((entry) => [entry.cardId, entry.name, entry.replaced])).toEqual([
            ['c1', 'Lyra', true],
            ['c3', 'Tess', false],
        ])
    })
})

describe('refreshBatches', () => {
    it('sends at most six unique card ids per request', () => {
        expect(refreshBatches([])).toEqual([])
        const ids = Array.from({ length: 8 }, (_, index) => `c${index}`)
        const batches = refreshBatches([...ids, 'c0'])
        expect(batches.map((batch) => batch.length)).toEqual([MAX_REFRESH_CARD_IDS, 2])
        expect(batches.flat()).toEqual(ids)
    })
})
