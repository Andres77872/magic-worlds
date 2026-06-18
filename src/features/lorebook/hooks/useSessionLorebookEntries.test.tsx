import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lorebook, LorebookEntry } from '@/shared'
import { apiService } from '@/infrastructure/api'
import { scanText } from '../loreTriggers'
import { useSessionLorebookEntries } from './useSessionLorebookEntries'

vi.mock('@/infrastructure/api', () => ({
    apiService: {
        listLorebookAttachments: vi.fn(),
        getLorebook: vi.fn(),
    },
}))

let lorebooks: Lorebook[] = []
vi.mock('@/app/hooks', () => ({
    useData: () => ({ lorebooks }),
}))

function bookWithKey(id: string, name: string, key: string): Lorebook {
    const entry: LorebookEntry = {
        id: `${id}-e`,
        lorebookId: id,
        title: 'Mirror pact',
        entryType: 'rule',
        content: 'Mirrors bind names.',
        keys: [key],
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        insertionOrder: 0,
        priority: 0,
        insertionPosition: 'before_context',
    }
    return {
        id,
        name,
        description: null,
        tags: [],
        enabled: true,
        settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false },
        entries: [entry],
        attachments: [],
    }
}

describe('useSessionLorebookEntries', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        lorebooks = []
    })

    it('builds a matcher from a linked attachment resolved via the cache', async () => {
        lorebooks = [bookWithKey('lb-1', 'Glass Courts', 'mirror')]
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-1', lorebookId: 'lb-1', targetKind: 'character_chat', targetId: '9', mode: 'linked' },
        ])

        const { result } = renderHook(() => useSessionLorebookEntries('character_chat', '9'))

        await waitFor(() => expect(result.current.matcher).not.toBeNull())
        expect(result.current.entries.map((e) => e.lorebookName)).toContain('Glass Courts')
        const hits = scanText('she gazed into the mirror', result.current.matcher)
        expect(hits).toHaveLength(1)
        expect(hits[0]).toMatchObject({ keyword: 'mirror', lorebookName: 'Glass Courts' })
        expect(apiService.getLorebook).not.toHaveBeenCalled()
    })

    it('resolves a snapshot attachment without touching the cache or network', async () => {
        const snapshot = bookWithKey('lb-2', 'Frozen Codex', 'sigil')
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([
            { id: 'att-2', lorebookId: 'lb-2', targetKind: 'adventure_session', targetId: '4', mode: 'snapshot', snapshot },
        ])

        const { result } = renderHook(() => useSessionLorebookEntries('adventure_session', '4'))

        await waitFor(() => expect(result.current.matcher).not.toBeNull())
        const hits = scanText('the ancient sigil glowed', result.current.matcher)
        expect(hits).toHaveLength(1)
        expect(hits[0]).toMatchObject({ keyword: 'sigil', lorebookName: 'Frozen Codex' })
    })

    it('has a null matcher when no lorebooks are attached', async () => {
        vi.mocked(apiService.listLorebookAttachments).mockResolvedValue([])
        const { result } = renderHook(() => useSessionLorebookEntries('character_chat', '9'))
        await waitFor(() => expect(apiService.listLorebookAttachments).toHaveBeenCalled())
        expect(result.current.matcher).toBeNull()
    })
})
