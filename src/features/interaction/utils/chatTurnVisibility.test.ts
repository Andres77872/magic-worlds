import { describe, expect, it } from 'vitest'
import type { TurnEntry } from '@/shared'
import { isUnsavedReply, lastUserIndex, latestExchangeReply, transcriptItems, unsavedReplyReason } from './chatTurnVisibility'

const user = (id: string): TurnEntry => ({ id, type: 'user', content: 'Hola', timestamp: '' })
const reply = (id: string): TurnEntry => ({ id, type: 'ai', content: 'Hi', timestamp: '' })
const inactive = (id: string): TurnEntry => ({ ...reply(id), metadata: { inactive_variant: true } })
const writing = (id: string): TurnEntry => ({ id, type: 'ai', content: '', timestamp: '', isStreaming: true })
const failed = (id: string, category = 'execution_failed'): TurnEntry => ({
    id, type: 'ai', content: '', timestamp: '', metadata: { interrupted: true, error_category: category },
})

describe('chat transcript visibility', () => {
    it('drops attempts superseded by a retry and keeps only the reply', () => {
        const items = transcriptItems([user('1'), failed('2'), failed('3'), reply('4')])
        expect(items).toEqual([{ kind: 'message', turn: user('1') }, { kind: 'message', turn: reply('4') }])
    })

    it('shows a trailing unsaved reply as a notice, never as a message', () => {
        const items = transcriptItems([user('1'), failed('2'), failed('3')])
        expect(items.map((item) => [item.kind, item.turn.id])).toEqual([['message', '1'], ['unsaved', '3']])
    })

    it('drops an unsaved reply once the player moved on', () => {
        const items = transcriptItems([user('1'), failed('2'), user('3'), reply('4')])
        expect(items.map((item) => item.turn.id)).toEqual(['1', '3', '4'])
    })

    it('keeps a streaming reply visible', () => {
        const streaming: TurnEntry = { ...failed('2'), isStreaming: true }
        expect(isUnsavedReply(streaming)).toBe(false)
        expect(transcriptItems([user('1'), streaming])).toHaveLength(2)
    })

    it('tells a stopped reply from a failed one', () => {
        expect(unsavedReplyReason(failed('2', 'cancelled'))).toBe('stopped')
        expect(unsavedReplyReason(failed('2'))).toBe('failed')
    })

    it('shows the active version of the latest reply with every stored version', () => {
        const items = transcriptItems([user('1'), inactive('2'), reply('3'), inactive('4')])
        expect(items).toEqual([
            { kind: 'message', turn: user('1') },
            { kind: 'message', turn: reply('3'), versions: { ids: ['2', '3', '4'], index: 1 } },
        ])
    })

    it('writes a new version in the slot of the current one', () => {
        const items = transcriptItems([user('1'), reply('2'), writing('3')])
        expect(items.map((item) => [item.turn.id, item.kind === 'message' ? item.versions : undefined])).toEqual([
            ['1', undefined], ['3', { ids: ['2', '3'], index: 1 }],
        ])
    })

    it('keeps the current version when a new one fails', () => {
        const items = transcriptItems([user('1'), reply('2'), failed('3')])
        expect(items.map((item) => [item.kind, item.turn.id])).toEqual([['message', '1'], ['message', '2'], ['unsaved', '3']])
        expect(items[1]).not.toHaveProperty('versions')
    })

    it('shows older exchanges with only the version the story continued from', () => {
        const items = transcriptItems([user('1'), inactive('2'), reply('3'), user('4'), reply('5')])
        expect(items.map((item) => item.turn.id)).toEqual(['1', '3', '4', '5'])
        expect(items.some((item) => item.kind === 'message' && item.versions)).toBe(false)
    })

    it('falls back to the newest version when none is active', () => {
        expect(latestExchangeReply([user('1'), inactive('2'), inactive('3')]).shown?.id).toBe('3')
        expect(latestExchangeReply([reply('1')]).shown).toBeUndefined()
    })

    it('finds the player message the trailing replies answer', () => {
        expect(lastUserIndex([user('1'), reply('2'), user('3'), failed('4')])).toBe(2)
        expect(lastUserIndex([reply('1')])).toBe(-1)
    })
})
