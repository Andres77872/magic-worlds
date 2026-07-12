import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanonicalConversationMessage } from '@/shared'
import { apiService } from './index'

const fetchMock = vi.fn()

function message(sequence: number): CanonicalConversationMessage {
    return {
        message_id: sequence,
        turn_id: `turn-${sequence}`,
        sequence_no: sequence,
        role: sequence % 2 ? 'user' : 'assistant',
        status: 'completed',
        content: `Message ${sequence}`,
        metadata: {},
        created_at: '2026-07-12T00:00:00Z',
        updated_at: '2026-07-12T00:00:00Z',
        completed_at: '2026-07-12T00:00:00Z',
    }
}

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('canonical API request contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('VITE_FEATURE_LOREBOOKS_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'test-token')
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        localStorage.clear()
    })

    it('keeps lorebook entry identity exclusively in the update URL', async () => {
        fetchMock.mockResolvedValueOnce(json({}))

        await apiService.updateLorebookEntry('book-1', 'entry-1', {
            id: 'entry-1',
            lorebookId: 'book-1',
            title: 'Mirror oath',
            content: 'Names bind.',
        })

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/lorebooks\/book-1\/entries\/entry-1$/)
        expect(JSON.parse(String(init.body))).toMatchObject({ title: 'Mirror oath', content: 'Names bind.' })
        expect(JSON.parse(String(init.body))).not.toHaveProperty('id')
        expect(JSON.parse(String(init.body))).not.toHaveProperty('lorebookId')
    })

    it.each([
        ['adventure', (before: number | undefined) => ({ adventure_id: 7, version: 3, messages: before ? [message(1), message(2)] : Array.from({ length: 200 }, (_, index) => message(index + 3)) })],
        ['character', (before: number | undefined) => ({ chat_id: 9, version: 4, messages: before ? [message(1), message(2)] : Array.from({ length: 200 }, (_, index) => message(index + 3)) })],
    ] as const)('loads complete %s history through before_sequence pagination', async (kind, page) => {
        fetchMock.mockImplementation(async (input: string | URL | Request) => {
            const before = new URL(String(input)).searchParams.get('before_sequence')
            return json(page(before ? Number(before) : undefined))
        })

        const result = kind === 'adventure'
            ? await apiService.getAdventureSessionMessages(7)
            : await apiService.getCharacterChatMessages(9)

        expect(result.messages).toHaveLength(202)
        expect(result.messages[0].sequence_no).toBe(1)
        expect(result.messages[result.messages.length - 1]?.sequence_no).toBe(202)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(String(fetchMock.mock.calls[1][0])).toContain('before_sequence=3')
    })
})
