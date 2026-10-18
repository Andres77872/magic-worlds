import type { ShellFailure, ShellStatus } from './shellProtocol'

const protocol = 'novel-offline-shell-v1'
export type OfflineAppState = {
    state: 'empty' | 'ready' | 'waiting' | 'failed' | 'unsupported' | 'foreign'
    reason?: ShellFailure | 'secure' | 'development' | 'browser'
    bytes?: number
    buildId?: string
}
interface Environment {
    production: boolean
    secure: boolean
    origin: string
    basePath: string
    serviceWorker: ServiceWorkerContainer | null
}
function browserServiceWorker(): ServiceWorkerContainer | null {
    try { return typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null }
    catch { return null }
}
const environment = (): Environment => ({ production: import.meta.env.PROD, secure: window.isSecureContext,
    origin: window.location.origin, basePath: import.meta.env.BASE_URL,
    serviceWorker: browserServiceWorker() })
const urls = (env: Environment) => {
    const scope = new URL(env.basePath, env.origin), worker = new URL('novel-offline-worker.js', scope)
    return { scope, worker }
}
function supported(env: Environment): OfflineAppState | null {
    if (!env.production) return { state: 'unsupported', reason: 'development' }
    if (!env.secure) return { state: 'unsupported', reason: 'secure' }
    if (!env.serviceWorker || typeof MessageChannel === 'undefined') return { state: 'unsupported', reason: 'browser' }
    const { scope } = urls(env)
    return scope.origin === env.origin && scope.pathname.endsWith('/') ? null : { state: 'unsupported', reason: 'browser' }
}
function owned(registration: ServiceWorkerRegistration, env: Environment) {
    const expected = urls(env)
    return registration.scope === expected.scope.href
        && [registration.active, registration.waiting, registration.installing].every((worker) => !worker || worker.scriptURL === expected.worker.href)
}
async function find(env: Environment): Promise<ServiceWorkerRegistration | 'foreign' | null> {
    const { scope } = urls(env), registrations = await env.serviceWorker!.getRegistrations()
    const covering = registrations.filter((item) => scope.href.startsWith(item.scope))
    if (covering.some((item) => !owned(item, env))) return 'foreign'
    return covering.find((item) => item.scope === scope.href) ?? null
}
function ask(worker: ServiceWorker, type: 'status' | 'prepare'): Promise<ShellStatus> {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel()
        const close = () => { clearTimeout(timeout); channel.port1.close(); channel.port2.close() }
        const timeout = setTimeout(() => { close(); reject(new Error('Offline app check timed out')) }, 30_000)
        channel.port1.onmessage = (event: MessageEvent<unknown>) => {
            const value = event.data as Partial<ShellStatus> | null
            if (!value || value.protocol !== protocol || !['ready', 'empty', 'failed'].includes(String(value.state))
                || typeof value.buildId !== 'string' || !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 0
                || value.reason !== undefined && !['network', 'integrity', 'storage', 'limit'].includes(value.reason)) return
            close(); resolve(value as ShellStatus)
        }
        try { worker.postMessage({ protocol, type }, [channel.port2]) }
        catch (error) { close(); reject(error) }
    })
}
function settled(worker: ServiceWorker): Promise<void> {
    return new Promise((resolve, reject) => {
        const finish = () => { clearTimeout(timeout); worker.removeEventListener('statechange', check) }
        const check = () => {
            if (worker.state === 'installed' || worker.state === 'activated') { finish(); resolve() }
            else if (worker.state === 'redundant') { finish(); reject(new Error('Offline app installation failed')) }
        }
        const timeout = setTimeout(() => { finish(); reject(new Error('Offline app installation timed out')) }, 60_000)
        worker.addEventListener('statechange', check); check()
    })
}
const presentation = (status: ShellStatus, waiting: boolean): OfflineAppState => ({ ...status, state: status.state === 'ready' && waiting ? 'waiting' : status.state })

export function offlineAppControlled(): boolean {
    try {
        const env = environment()
        return Boolean(env.serviceWorker?.controller?.scriptURL === urls(env).worker.href)
    } catch { return false }
}
export function subscribeOfflineAppControl(listener: () => void): () => void {
    const worker = browserServiceWorker()
    worker?.addEventListener('controllerchange', listener)
    return () => worker?.removeEventListener('controllerchange', listener)
}
/** Read-only status. Never registers, downloads or changes another worker. */
export async function inspectOfflineApp(env = environment()): Promise<OfflineAppState> {
    try {
        const unsupported = supported(env)
        if (unsupported) return unsupported
        const registration = await find(env)
        if (registration === 'foreign') return { state: 'foreign' }
        if (!registration) return { state: 'empty' }
        const worker = registration.waiting ?? registration.active
        if (!worker) return { state: 'empty' }
        return presentation(await ask(worker, 'status'), worker === registration.waiting)
    } catch { return { state: 'failed', reason: 'storage' } }
}
/** Explicit opt-in. No skipWaiting, reload, unregister, clearing or private URL input. */
export async function prepareOfflineApp(env = environment()): Promise<OfflineAppState> {
    let stopObserving = () => {}
    try {
        const unsupported = supported(env)
        if (unsupported) return unsupported
        let registration = await find(env)
        if (registration === 'foreign') return { state: 'foreign' }
        const observed = { worker: null as ServiceWorker | null }
        if (registration) {
            const updating = registration
            const found = () => { if (updating.installing) observed.worker = updating.installing }
            updating.addEventListener('updatefound', found)
            stopObserving = () => updating.removeEventListener('updatefound', found)
            found()
            await updating.update()
        }
        else {
            const target = urls(env)
            registration = await env.serviceWorker!.register(target.worker.href, { scope: target.scope.href, type: 'module', updateViaCache: 'none' })
        }
        if (!owned(registration, env)) return { state: 'foreign' }
        const candidate = observed.worker ?? registration.installing ?? registration.waiting ?? registration.active
        if (!candidate) return { state: 'failed', reason: 'network' }
        await settled(candidate)
        const worker = registration.waiting ?? registration.active ?? candidate
        const status = await ask(worker, 'prepare')
        return presentation(status, worker === registration.waiting || worker.state === 'installed')
    } catch { return { state: 'failed', reason: 'network' } }
    finally { stopObserving() }
}
