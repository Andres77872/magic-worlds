import type { ShellAsset, ShellFailure, ShellManifest, ShellStatus } from './shellProtocol'

export interface ShellWorkerHost {
    location: { origin: string }
    registration: { scope: string }
    caches: CacheStorage
    indexedDB: IDBFactory
    crypto: Pick<Crypto, 'subtle'>
    fetch: typeof fetch
}

/** Compiled as a standalone module worker; its only import is erased typing. */
export function createShellRuntime(host: ShellWorkerHost, manifest: ShellManifest) {
    const allowance = 64 * 1024 * 1024, protocol = 'novel-offline-shell-v1' as const
    const base = new URL(manifest.basePath, host.location.origin)
    const name = 'magic-worlds-offline-shell:v1:' + base.href + ':' + manifest.id
    const marker = new URL('.novel-offline-ready-' + manifest.id, base).href
    const assets = new Map(manifest.assets.map((asset) => [new URL(asset.path, base).href, asset]))
    const result = (state: ShellStatus['state'], reason?: ShellFailure): ShellStatus => ({ protocol, state, buildId: manifest.buildId, bytes: manifest.bytes, ...(reason ? { reason } : {}) })
    const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
    const size = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
    const validManifest = () => manifest.schema === 1 && /^[a-f0-9]{64}$/.test(manifest.id) && Boolean(manifest.buildId)
        && base.origin === host.location.origin && base.href === host.registration.scope && manifest.basePath === base.pathname
        && base.pathname.endsWith('/') && !base.search && !base.hash && assets.size === manifest.assets.length
        && manifest.assets.length > 0 && manifest.assets.length <= 2048 && size(manifest.bytes)
        && manifest.assets.reduce((total, asset) => total + asset.bytes, 0) === manifest.bytes
        && manifest.assets.some((asset) => asset.path === base.pathname + 'index.html')
        && manifest.assets.every((asset) => {
            const url = new URL(asset.path, base)
            return url.origin === base.origin && url.pathname.startsWith(base.pathname) && url.pathname === asset.path && !url.search && !url.hash
                && !/%(?:2f|5c)/i.test(asset.path) && /^[a-f0-9]{64}$/.test(asset.sha256) && size(asset.bytes)
                && asset.path !== base.pathname + 'version.json' && asset.path !== base.pathname + 'novel-offline-worker.js'
                && (asset.path === base.pathname + 'index.html' || /\.(?:js|css|svg|png|jpe?g|webp|avif|ico|woff2?|ttf|webmanifest)$/.test(asset.path))
        })

    async function reserve(): Promise<boolean> {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            let settled = false
            const request = host.indexedDB.open('magic-worlds-offline-shell-budget-v1', 1)
            request.onupgradeneeded = () => {
                request.result.createObjectStore('builds', { keyPath: 'key' }).createIndex('scope', 'scope')
                request.result.createObjectStore('usage', { keyPath: 'key' })
            }
            request.onblocked = request.onerror = () => { settled = true; reject(new Error('storage')) }
            request.onsuccess = () => { if (settled) request.result.close(); else resolve(request.result) }
        })
        database.onversionchange = () => database.close()
        try {
            return await new Promise<boolean>((resolve, reject) => {
                const transaction = database.transaction(['builds', 'usage'], 'readwrite')
                const builds = transaction.objectStore('builds'), usage = transaction.objectStore('usage')
                const previous = builds.get(name), counter = usage.get(base.href)
                let outstanding = 2, accepted = false
                const refuse = () => transaction.abort()
                const write = (used: number) => {
                    if (used + manifest.bytes > allowance) { refuse(); return }
                    builds.put({ schema: 1, key: name, scope: base.href, bytes: manifest.bytes, digest: manifest.id })
                    usage.put({ schema: 1, key: base.href, bytes: used + manifest.bytes }); accepted = true
                }
                const ready = () => {
                    if (--outstanding) return
                    const old: unknown = previous.result, used: unknown = counter.result
                    if (used !== undefined && (!record(used) || used.schema !== 1 || !size(used.bytes))) { refuse(); return }
                    if (old !== undefined) {
                        if (!record(old) || old.schema !== 1 || old.scope !== base.href || old.digest !== manifest.id || old.bytes !== manifest.bytes
                            || !record(used) || !size(used.bytes) || used.bytes < manifest.bytes) { refuse(); return }
                        accepted = true; return
                    }
                    if (used === undefined) {
                        const existing = builds.index('scope').count(base.href)
                        existing.onsuccess = () => { if (existing.result) refuse(); else write(0) }
                    } else write(Number((used as Record<string, unknown>).bytes))
                }
                previous.onsuccess = counter.onsuccess = ready
                transaction.oncomplete = () => resolve(accepted)
                transaction.onabort = () => resolve(false)
                transaction.onerror = () => reject(new Error('storage'))
            })
        } finally { database.close() }
    }

    async function verify(response: Response, asset: ShellAsset): Promise<boolean> {
        if (response.status !== 200 || !response.body || response.redirected || response.type === 'opaque') return false
        const reader = response.body.getReader(), chunks: Uint8Array[] = []
        let length = 0
        try {
            while (true) {
                const next = await reader.read()
                if (next.done) break
                length += next.value.byteLength
                if (length > asset.bytes) { void reader.cancel().catch(() => {}); return false }
                chunks.push(next.value)
            }
        } finally { reader.releaseLock() }
        if (length !== asset.bytes) return false
        const bytes = new Uint8Array(length)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
        const digest = [...new Uint8Array(await host.crypto.subtle.digest('SHA-256', bytes))].map((value) => value.toString(16).padStart(2, '0')).join('')
        return digest === asset.sha256
    }

    async function status(): Promise<ShellStatus> {
        try {
            if (!validManifest()) return result('failed', 'integrity')
            const cache = await host.caches.open(name), ready = await cache.match(marker)
            if (!ready) return result('empty')
            const value: unknown = await ready.json()
            if (!record(value) || value.schema !== 1 || value.id !== manifest.id) return result('empty')
            for (const [url, asset] of assets) {
                const saved = await cache.match(url)
                if (!saved || !await verify(saved, asset)) return result('empty')
            }
            return result('ready')
        } catch { return result('failed', 'storage') }
    }
    let preparing: Promise<ShellStatus> | null = null
    function prepare(): Promise<ShellStatus> {
        if (preparing) return preparing
        preparing = (async () => {
            try {
                if (!validManifest()) return result('failed', 'integrity')
                if (manifest.bytes > allowance || !await reserve()) return result('failed', 'limit')
                const cache = await host.caches.open(name)
                for (const [url, asset] of assets) {
                    const existing = await cache.match(url)
                    if (existing && await verify(existing, asset)) continue
                    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 15_000)
                    try {
                        const response = await host.fetch(url, { method: 'GET', credentials: 'omit', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: abort.signal })
                        if (response.url !== url || !await verify(response.clone(), asset)) { abort.abort(); return result('failed', 'integrity') }
                        await cache.put(url, response)
                    } catch { return result('failed', 'network') }
                    finally { clearTimeout(timeout) }
                }
                await cache.put(marker, new Response(JSON.stringify({ schema: 1, id: manifest.id }), { headers: { 'Content-Type': 'application/json' } }))
                return await status()
            } catch { return result('failed', 'storage') }
            finally { preparing = null }
        })()
        return preparing
    }

    /** Only public build assets and the query-free app entry are intercepted. */
    function respond(request: Request): Promise<Response> | null {
        const url = new URL(request.url)
        if (request.method !== 'GET' || url.origin !== base.origin || url.search || request.headers.has('Authorization') || request.headers.has('Range')) return null
        const navigation = request.mode === 'navigate' && (url.pathname === base.pathname || url.pathname === base.pathname + 'index.html')
        const asset = navigation ? manifest.assets.find((item) => item.path === base.pathname + 'index.html') : assets.get(url.href)
        if (!asset || !validManifest()) return null
        return (async () => {
            try {
                // A pinned, verified build stays coherent until normal worker
                // activation. A new deployment cannot replace open writing.
                if (!navigation || (await status()).state === 'ready') {
                    const saved = await (await host.caches.open(name)).match(new URL(asset.path, base).href)
                    if (saved && await verify(saved.clone(), asset)) return saved
                }
            } catch { /* Network may still provide the ordinary app response. */ }
            return host.fetch(request)
        })()
    }
    async function message(sourceUrl: unknown, data: unknown): Promise<ShellStatus | null> {
        if (typeof sourceUrl !== 'string' || !record(data) || data.protocol !== protocol || !['status', 'prepare'].includes(String(data.type))) return null
        let source: URL
        try { source = new URL(sourceUrl) } catch { return null }
        if (source.origin !== base.origin || !source.pathname.startsWith(base.pathname)) return null
        return data.type === 'prepare' ? prepare() : status()
    }
    return { prepare, status, respond, message }
}
