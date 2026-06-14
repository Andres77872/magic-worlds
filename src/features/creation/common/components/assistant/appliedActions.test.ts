import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import type { CardAssistantMessage } from '@/shared/types/aiCard.types'
import {
    attachAppliedChanges,
    formatAppliedChange,
    humanizeField,
    parseAppliedActions,
    parseToolMessageActions,
    type AppliedChangeSummary,
} from './appliedActions'

const t = i18n.t.bind(i18n)

function message(overrides: Partial<CardAssistantMessage>): CardAssistantMessage {
    return {
        message_id: 1,
        conversation_id: 10,
        sequence_no: 1,
        role: 'user',
        status: 'completed',
        content: '',
        ...overrides,
    }
}

describe('parseAppliedActions', () => {
    it('maps replace_card and patch_card, dropping no-change and unknown actions', () => {
        const result = parseAppliedActions([
            { type: 'replace_card', card_id: 'card-1' },
            { type: 'patch_card', card_id: 'card-1', fields: ['name', 'image_url'] },
            { type: 'no_card_change' },
            { type: 'mystery' },
        ])
        expect(result).toEqual([
            { kind: 'replace', cardId: 'card-1', fields: [] },
            { kind: 'patch', cardId: 'card-1', fields: ['name', 'image url'] },
        ])
    })

    it('returns [] for non-arrays and ignores malformed entries', () => {
        expect(parseAppliedActions(undefined)).toEqual([])
        expect(parseAppliedActions('nope')).toEqual([])
        expect(parseAppliedActions([null, 42, 'x'])).toEqual([])
        expect(parseAppliedActions([{ type: 'patch_card', fields: 'name' }])).toEqual([
            { kind: 'patch', cardId: undefined, fields: [] },
        ])
    })
})

describe('parseToolMessageActions', () => {
    it('parses applied_actions from tool message JSON content', () => {
        const tool = message({
            role: 'tool',
            content: JSON.stringify({ applied_actions: [{ type: 'patch_card', fields: ['description'] }], card_id: 'card-1' }),
        })
        expect(parseToolMessageActions(tool)).toEqual([{ kind: 'patch', cardId: undefined, fields: ['description'] }])
    })

    it('returns [] for non-tool roles, empty content, and malformed JSON', () => {
        expect(parseToolMessageActions(message({ role: 'assistant', content: '{}' }))).toEqual([])
        expect(parseToolMessageActions(message({ role: 'tool', content: '' }))).toEqual([])
        expect(parseToolMessageActions(message({ role: 'tool', content: 'not-json{' }))).toEqual([])
        expect(parseToolMessageActions(message({ role: 'tool', content: 'null' }))).toEqual([])
    })
})

describe('attachAppliedChanges', () => {
    const history: CardAssistantMessage[] = [
        message({ message_id: 1, role: 'user', content: 'make a world' }),
        message({ message_id: 2, role: 'assistant', content: 'Done!' }),
        message({
            message_id: 3,
            role: 'tool',
            content: JSON.stringify({ applied_actions: [{ type: 'replace_card', card_id: 'w-1' }] }),
        }),
        message({ message_id: 4, role: 'user', content: 'rename it' }),
        message({ message_id: 5, role: 'assistant', content: 'Renamed.' }),
        message({
            message_id: 6,
            role: 'tool',
            content: JSON.stringify({ applied_actions: [{ type: 'patch_card', fields: ['name'] }] }),
        }),
    ]

    it('attaches tool changes to the nearest preceding assistant turn and hides tool/system rows', () => {
        const turns = attachAppliedChanges(history)
        expect(turns.map((turn) => turn.message.message_id)).toEqual([1, 2, 4, 5])
        expect(turns[1].appliedChanges).toEqual([{ kind: 'replace', cardId: 'w-1', fields: [] }])
        expect(turns[3].appliedChanges).toEqual([{ kind: 'patch', cardId: undefined, fields: ['name'] }])
        expect(turns[0].appliedChanges).toEqual([])
    })

    it('prefers live actions over the tool-message reconstruction for the same assistant message', () => {
        const live = new Map<number, AppliedChangeSummary[]>([
            [2, [{ kind: 'patch', cardId: 'w-1', fields: ['description'] }]],
        ])
        const turns = attachAppliedChanges(history, live)
        expect(turns[1].appliedChanges).toEqual([{ kind: 'patch', cardId: 'w-1', fields: ['description'] }])
        // Message 5 has no live entry, so its tool message still applies.
        expect(turns[3].appliedChanges).toEqual([{ kind: 'patch', cardId: undefined, fields: ['name'] }])
    })

    it('drops tool messages with no preceding assistant turn', () => {
        const turns = attachAppliedChanges([
            message({ message_id: 1, role: 'tool', content: JSON.stringify({ applied_actions: [{ type: 'replace_card' }] }) }),
            message({ message_id: 2, role: 'user', content: 'hi' }),
        ])
        expect(turns).toHaveLength(1)
        expect(turns[0].message.message_id).toBe(2)
    })
})

describe('formatAppliedChange', () => {
    it('labels replace as Card saved', () => {
        expect(formatAppliedChange({ kind: 'replace', fields: [] }, t)).toEqual({ label: 'Card saved' })
    })

    it('labels a fieldless patch as Card updated', () => {
        expect(formatAppliedChange({ kind: 'patch', fields: [] }, t)).toEqual({ label: 'Card updated' })
    })

    it('lists up to four fields then truncates with +N more, keeping the full list in title', () => {
        expect(formatAppliedChange({ kind: 'patch', fields: ['name', 'race'] }, t).label).toBe('Updated: name, race')
        const long = formatAppliedChange({ kind: 'patch', fields: ['a', 'b', 'c', 'd', 'e', 'f'] }, t)
        expect(long.label).toBe('Updated: a, b, c, d +2 more')
        expect(long.title).toBe('Updated fields: a, b, c, d, e, f')
    })
})

describe('humanizeField', () => {
    it('replaces underscores with spaces', () => {
        expect(humanizeField('system_instructions')).toBe('system instructions')
        expect(humanizeField('name')).toBe('name')
    })
})
