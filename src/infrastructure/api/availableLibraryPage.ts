import type { LibraryPage, LibraryQuery } from '@/shared/types/workspace.types'
import { isContentTypeFeatureEnabled, LIBRARY_CARD_TYPES } from '@/shared/featureFlags'

type ReadPage = (query: LibraryQuery) => Promise<LibraryPage>
interface Scan {
    items: LibraryPage['items']
    total: number
    rawOffset: number
    done: boolean
}
interface ScanEntry { scan?: Scan; updated: number }
const RAW_PAGE_SIZE = 100
const MAX_SCANS = 8
const SCAN_TTL_MS = 60_000

/**
 * Preserve the server's mixed order without rescanning its prefix on every
 * visible page. Each scan belongs to an auth owner, workspace and exact query.
 * Offset zero always revalidates; writes invalidate scans through ApiService.
 * Readers work on snapshots: an aborted or superseded read cannot corrupt a
 * continuation. No signal or scoped client is retained in the cache.
 */
export class AvailableLibraryPages {
    private readonly scans = new Map<string, ScanEntry>()

    clear(): void { this.scans.clear() }

    async read(read: ReadPage, query: LibraryQuery, scope: string, signal?: AbortSignal): Promise<LibraryPage> {
        signal?.throwIfAborted()
        const limit = query.limit ?? 24
        const offset = query.offset ?? 0
        const empty = { items: [], total: 0, limit, offset }
        if (query.card_type) return isContentTypeFeatureEnabled(query.card_type) ? read(query) : empty
        const types = LIBRARY_CARD_TYPES.filter(isContentTypeFeatureEnabled)
        if (types.length === LIBRARY_CARD_TYPES.length) return read(query)

        const key = JSON.stringify([scope, types, query.q?.trim() ?? '', query.collection_id ?? null, Boolean(query.uncollected)])
        let entry = this.scans.get(key)
        if (offset === 0 || !entry || Date.now() - entry.updated > SCAN_TTL_MS) {
            entry = { updated: Date.now() }
            this.scans.delete(key)
            this.scans.set(key, entry)
            while (this.scans.size > MAX_SCANS) this.scans.delete(this.scans.keys().next().value!)
        }
        const cached = entry.scan
        const scan: Scan = cached ? { ...cached, items: [...cached.items] } : {
            items: [], total: 0, rawOffset: 0, done: false,
        }
        if (!cached) {
            const counts = await Promise.all(types.map(card_type => read({ ...query, card_type, limit: 1, offset: 0 })))
            scan.total = counts.reduce((sum, page) => sum + page.total, 0)
        }
        while (offset < scan.total && !scan.done && scan.items.length < offset + limit) {
            signal?.throwIfAborted()
            const page = await read({ ...query, offset: scan.rawOffset, limit: RAW_PAGE_SIZE })
            scan.items.push(...page.items.filter(item => isContentTypeFeatureEnabled(item.card_type)))
            scan.rawOffset += page.items.length
            scan.done = page.items.length === 0 || scan.rawOffset >= page.total
        }
        signal?.throwIfAborted()
        if (this.scans.get(key) === entry && (!entry.scan || entry.scan.rawOffset <= scan.rawOffset)) {
            entry.scan = scan
            entry.updated = Date.now()
        }
        return { items: structuredClone(scan.items.slice(offset, offset + limit)), total: scan.total, limit, offset }
    }
}

/** Standalone read for consumers that do not retain a paging session. */
export function availableLibraryPage(read: ReadPage, query: LibraryQuery): Promise<LibraryPage> {
    return new AvailableLibraryPages().read(read, query, '')
}
