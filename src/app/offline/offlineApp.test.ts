import { afterEach, expect, it, vi } from 'vitest'
import { inspectOfflineApp, prepareOfflineApp, subscribeOfflineAppControl } from './offlineApp'

class Channel {
    port1 = { onmessage: null as ((event: { data: unknown }) => void) | null, close: vi.fn() }
    port2 = { close: vi.fn(), postMessage: (data: unknown) => queueMicrotask(() => this.port1.onmessage?.({ data })) }
}
afterEach(() => { vi.unstubAllGlobals() })
it('does not break the app shell when browser policy denies the worker accessor', () => {
    vi.stubGlobal('navigator', Object.defineProperty({}, 'serviceWorker', { get() { throw new DOMException('Denied', 'SecurityError') } }))
    expect(() => subscribeOfflineAppControl(() => {})()).not.toThrow()
})
function worker(buildId: string, state: 'activated' | 'installed' = 'activated') {
    return { state, scriptURL: 'https://offline-app.example/app/novel-offline-worker.js', addEventListener: vi.fn(), removeEventListener: vi.fn(),
        postMessage: vi.fn((_message: unknown, ports: Transferable[]) => (ports[0] as MessagePort).postMessage({ protocol: 'novel-offline-shell-v1', state: 'ready', buildId, bytes: 4096 })) } as unknown as ServiceWorker
}
function setup(registrations: ServiceWorkerRegistration[] = []) {
    vi.stubGlobal('MessageChannel', Channel)
    const service = { getRegistrations: vi.fn(async () => registrations), register: vi.fn() }
    return { service, env: { production: true, secure: true, origin: 'https://offline-app.example', basePath: '/app/', serviceWorker: service as unknown as ServiceWorkerContainer } }
}
it('does not register during inspection or on unsupported origins and development builds', async () => {
    const { service, env } = setup()
    expect(await inspectOfflineApp(env)).toEqual({ state: 'empty' })
    expect(await prepareOfflineApp({ ...env, secure: false })).toEqual({ state: 'unsupported', reason: 'secure' })
    expect(await prepareOfflineApp({ ...env, production: false })).toEqual({ state: 'unsupported', reason: 'development' })
    expect(service.register).not.toHaveBeenCalled()
})
it('refuses an unrelated covering worker without updating or replacing it', async () => {
    const update = vi.fn(), foreign = { scope: 'https://offline-app.example/', active: { scriptURL: 'https://offline-app.example/other-worker.js' }, update } as unknown as ServiceWorkerRegistration
    const { env, service } = setup([foreign])
    expect(await prepareOfflineApp(env)).toEqual({ state: 'foreign' })
    expect(update).not.toHaveBeenCalled(); expect(service.register).not.toHaveBeenCalled()
})
it('reports a verified downloaded update while preserving the active worker and open page', async () => {
    const active = worker('first'), waiting = worker('second', 'installed'), unregister = vi.fn()
    const registration = { scope: 'https://offline-app.example/app/', active, waiting, installing: null, update: vi.fn(async () => {}), unregister, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as ServiceWorkerRegistration
    const { env, service } = setup([registration])
    expect(await prepareOfflineApp(env)).toMatchObject({ state: 'waiting', buildId: 'second' })
    expect(registration.active).toBe(active)
    expect(unregister).not.toHaveBeenCalled(); expect(service.register).not.toHaveBeenCalled()
    expect(waiting.postMessage).toHaveBeenCalledWith({ protocol: 'novel-offline-shell-v1', type: 'prepare' }, expect.any(Array))
    expect(active.postMessage).not.toHaveBeenCalled()
})
it('reports a fast failed update even after the browser retires its installing reference', async () => {
    const active = worker('first'), candidate = worker('failed-second')
    Object.defineProperty(candidate, 'state', { value: 'redundant' })
    const events = new EventTarget()
    const registration = { scope: 'https://offline-app.example/app/', active, waiting: null, installing: null as ServiceWorker | null,
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        update: vi.fn(async () => { registration.installing = candidate; events.dispatchEvent(new Event('updatefound')); registration.installing = null }) }
    const { env } = setup([registration as unknown as ServiceWorkerRegistration])
    expect(await prepareOfflineApp(env)).toMatchObject({ state: 'failed' })
    expect(registration.active).toBe(active); expect(active.postMessage).not.toHaveBeenCalled()
})
