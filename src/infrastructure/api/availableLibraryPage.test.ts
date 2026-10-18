import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LibraryItem, LibraryQuery } from '@/shared/types/workspace.types'
import { availableLibraryPage, AvailableLibraryPages } from './availableLibraryPage'

afterEach(() => vi.unstubAllEnvs())

describe('available Library pagination', () => {
    it('preserves mixed server order with accurate visible totals and offsets', async () => {
        setTestFeatureFlags({ adventures: false })
        const item = (id: string, card_type: LibraryItem['card_type']): LibraryItem => ({
            card_type, card: { id, organization: { workspace_id: 'workspace', collection_ids: [] } },
        })
        const rows = [item('6', 'character'), item('5', 'adventure_template'), item('4', 'world'), item('3', 'item'), item('2', 'character')]
        const read = vi.fn(async (query: LibraryQuery) => {
            const matching = rows.filter(row => !query.card_type || row.card_type === query.card_type)
            return { items: matching.slice(query.offset, (query.offset ?? 0) + (query.limit ?? 24)), total: matching.length, limit: query.limit!, offset: query.offset! }
        })
        const first = await availableLibraryPage(read, { limit: 2, q: 'query', collection_id: 'collection' })
        const second = await availableLibraryPage(read, { limit: 2, offset: 2, q: 'query', collection_id: 'collection' })
        expect(first.items.map(row => row.card.id)).toEqual(['6', '4'])
        expect(second.items.map(row => row.card.id)).toEqual(['3', '2'])
        expect(first.total).toBe(4)
        expect(second.total).toBe(4)
        for (const [query] of read.mock.calls) {
            expect(query.card_type).not.toBe('adventure_template')
            expect(query).toMatchObject({ q: 'query', collection_id: 'collection' })
        }
    })

    it('continues through full pages containing only disabled adventures', async () => {
        setTestFeatureFlags({ adventures: false })
        const rows: LibraryItem[] = Array.from({ length: 205 }, (_, index) => ({
            card_type: 'adventure_template', card: { id: `hidden-${index}`, organization: { workspace_id: 'workspace', collection_ids: [] } },
        }))
        rows.push({ card_type: 'character', card: { id: 'visible', organization: { workspace_id: 'workspace', collection_ids: [] } } })
        const read = vi.fn(async (query: LibraryQuery) => {
            const matching = rows.filter(row => !query.card_type || row.card_type === query.card_type)
            return { items: matching.slice(query.offset, (query.offset ?? 0) + (query.limit ?? 24)), total: matching.length, limit: query.limit!, offset: query.offset! }
        })

        const page = await availableLibraryPage(read, { limit: 2 })

        expect(page.items.map(row => row.card.id)).toEqual(['visible'])
        expect(page.total).toBe(1)
        expect(read.mock.calls.filter(([query]) => !query.card_type).map(([query]) => query.offset)).toEqual([0, 100, 200])
    })

    it('does not request a disabled type from a legacy URL', async () => {
        setTestFeatureFlags({ adventures: false })
        const read = vi.fn()
        expect(await availableLibraryPage(read, { card_type: 'adventure_template', limit: 24 })).toEqual({ items: [], total: 0, limit: 24, offset: 0 })
        expect(read).not.toHaveBeenCalled()
    })

    it('retains visible paging progress and isolates owner, workspace and query', async () => {
        setTestFeatureFlags({ adventures: false })
        const item = (id: string, card_type: LibraryItem['card_type']): LibraryItem => ({
            card_type, card: { id, organization: { workspace_id: 'workspace', collection_ids: [] } },
        })
        const rows = [...Array.from({ length: 1000 }, (_, i) => item(`hidden-${i}`, 'adventure_template')),
            ...Array.from({ length: 250 }, (_, i) => item(`visible-${i}`, 'character'))]
        const read = vi.fn(async (query: LibraryQuery) => {
            const matching = rows.filter(row => !query.card_type || row.card_type === query.card_type)
            return { items: matching.slice(query.offset, (query.offset ?? 0) + (query.limit ?? 24)), total: matching.length, limit: query.limit!, offset: query.offset! }
        })
        const pager = new AvailableLibraryPages()
        expect((await pager.read(read, { limit: 24 }, 'owner-a:workspace-a')).items[0].card.id).toBe('visible-0')
        expect(read).toHaveBeenCalledTimes(14)
        expect((await pager.read(read, { limit: 24, offset: 24 }, 'owner-a:workspace-a')).items[0].card.id).toBe('visible-24')
        expect(read).toHaveBeenCalledTimes(14)
        const before = read.mock.calls.length
        expect((await pager.read(read, { limit: 24, offset: 96 }, 'owner-a:workspace-a')).items[0].card.id).toBe('visible-96')
        expect(read.mock.calls.slice(before).map(([query]) => query.offset)).toEqual([1100])
        for (const scope of ['owner-b:workspace-a', 'owner-a:workspace-b']) {
            const previous = read.mock.calls.length
            await pager.read(read, { limit: 24, offset: 24 }, scope)
            expect(read.mock.calls.length - previous).toBe(14)
        }
        const previous = read.mock.calls.length
        await pager.read(read, { limit: 24, offset: 24, q: 'another search', collection_id: 'another collection' }, 'owner-a:workspace-a')
        expect(read.mock.calls.length - previous).toBe(14)
        pager.clear()
        const afterClear = read.mock.calls.length
        await pager.read(read, { limit: 24, offset: 24 }, 'owner-a:workspace-a')
        expect(read.mock.calls.length - afterClear).toBe(14)
    })

    it('does not commit an aborted read, and revalidates an offset-zero refresh', async () => {
        setTestFeatureFlags({ adventures: false })
        const row: LibraryItem = { card_type: 'character', card: { id: 'fresh', organization: { workspace_id: 'workspace', collection_ids: [] } } }
        const controller = new AbortController()
        const pager = new AvailableLibraryPages()
        const aborted = vi.fn(async (query: LibraryQuery) => {
            if (!query.card_type) controller.abort()
            return { items: [row], total: 1, limit: 100, offset: 0 }
        })
        await expect(pager.read(aborted, { limit: 1 }, 'owner', controller.signal)).rejects.toThrow()
        const read = vi.fn(async () => ({ items: [row], total: 1, limit: 100, offset: 0 }))
        await pager.read(read, { limit: 1 }, 'owner')
        expect(read).toHaveBeenCalledTimes(4)
        await pager.read(read, { limit: 1 }, 'owner')
        expect(read).toHaveBeenCalledTimes(8)
    })
})
