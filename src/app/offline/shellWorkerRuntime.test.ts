import { createHash, webcrypto } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { createShellRuntime, type ShellWorkerHost } from './shellWorkerRuntime'
import type { ShellManifest } from './shellProtocol'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function setup() {
    const origin = 'https://offline-app.example', scope = origin + '/app/'
    const bodies = { '/app/index.html': '<html><body>Retained app</body></html>', '/app/assets/app.js': 'console.log("retained build")' }
    const manifest: ShellManifest = { schema: 1, id: hash('fixture-build'), buildId: 'fixture-build', basePath: '/app/', bytes: 0,
        assets: Object.entries(bodies).map(([path, body]) => ({ path, bytes: new TextEncoder().encode(body).byteLength, sha256: hash(body) })) }
    manifest.bytes = manifest.assets.reduce((sum, row) => sum + row.bytes, 0)
    const saved = new Map(Object.entries(bodies).map(([path, body]) => [origin + path, new Response(body)]))
    saved.set(scope + '.novel-offline-ready-' + manifest.id, new Response(JSON.stringify({ schema: 1, id: manifest.id })))
    const cache = { match: vi.fn(async (input: string) => saved.get(input)?.clone()), put: vi.fn(), delete: vi.fn() }
    const storage = { open: vi.fn(async () => cache), delete: vi.fn() }
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('Network app'))
    const host: ShellWorkerHost = { location: { origin }, registration: { scope }, caches: storage as unknown as CacheStorage,
        indexedDB: { open: () => { throw new Error('Storage blocked') } } as unknown as IDBFactory,
        crypto: webcrypto as unknown as Crypto, fetch }
    return { host, manifest, runtime: createShellRuntime(host, manifest), saved, cache, storage, fetch, origin }
}
function navigation(url: string) { const request = new Request(url); Object.defineProperty(request, 'mode', { value: 'navigate' }); return request }

it('serves one verified retained build for root navigation and its exact static assets', async () => {
    const value = setup()
    expect((await value.runtime.status()).state).toBe('ready')
    expect(await (await value.runtime.respond(navigation(value.origin + '/app/'))!).text()).toContain('Retained app')
    expect(await (await value.runtime.respond(new Request(value.origin + '/app/assets/app.js'))!).text()).toContain('retained build')
    expect(value.fetch).not.toHaveBeenCalled()
    expect(value.storage.delete).not.toHaveBeenCalled(); expect(value.cache.delete).not.toHaveBeenCalled()
})

it('does not intercept account/auth/version/media/query/range/write traffic', () => {
    const { runtime, origin, fetch, cache } = setup()
    for (const path of ['/app/auth/password/reset?token=secret', '/app/?token=secret', '/app/version.json', '/app/version.json?ts=1', '/api/stories', '/app/images/private.png', '/app/assets/unknown.js'])
        expect(runtime.respond(navigation(origin + path))).toBeNull()
    expect(runtime.respond(new Request(origin + '/app/assets/app.js', { method: 'POST', body: 'private' }))).toBeNull()
    expect(runtime.respond(new Request(origin + '/app/assets/app.js', { headers: { Authorization: 'Bearer private' } }))).toBeNull()
    expect(runtime.respond(new Request(origin + '/app/assets/app.js', { headers: { Range: 'bytes=0-10' } }))).toBeNull()
    expect(runtime.respond(new Request('https://api.example/app/assets/app.js'))).toBeNull()
    expect(cache.match).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})

it('does not call a partial or changed cache ready and preserves all earlier responses', async () => {
    const value = setup(), before = value.saved.size
    value.saved.set(value.origin + '/app/assets/app.js', new Response('A different deployment'))
    expect((await value.runtime.status()).state).toBe('empty')
    expect(await (await value.runtime.respond(navigation(value.origin + '/app/'))!).text()).toBe('Network app')
    expect(value.saved.size).toBe(before)
    expect(value.cache.put).not.toHaveBeenCalled(); expect(value.cache.delete).not.toHaveBeenCalled()
})

it('refuses blocked budget storage and malformed manifests without replacing earlier cache records', async () => {
    const value = setup()
    expect(await value.runtime.prepare()).toMatchObject({ state: 'failed', reason: 'storage' })
    const malformed = createShellRuntime(value.host, { ...value.manifest, bytes: value.manifest.bytes + 1 })
    expect(await malformed.prepare()).toMatchObject({ state: 'failed', reason: 'integrity' })
    expect(value.fetch).not.toHaveBeenCalled(); expect(value.cache.put).not.toHaveBeenCalled(); expect(value.cache.delete).not.toHaveBeenCalled()
})

it('accepts only scoped public status/prepare messages and no activation or clearing command', async () => {
    const { runtime } = setup(), status = { protocol: 'novel-offline-shell-v1', type: 'status' }
    expect(await runtime.message('https://offline-app.example/app/', status)).toMatchObject({ state: 'ready' })
    for (const source of ['https://another.example/app/', 'https://offline-app.example/outside/', 'malformed']) expect(await runtime.message(source, status)).toBeNull()
    for (const type of ['skipWaiting', 'clear', 'fetch']) expect(await runtime.message('https://offline-app.example/app/', { ...status, type })).toBeNull()
})
