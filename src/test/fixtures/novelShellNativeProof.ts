import { createShellRuntime } from '@/app/offline/shellWorkerRuntime'
import type { ShellManifest } from '@/app/offline/shellProtocol'
import { generateUUID } from '@/utils/uuid'

/** Opt-in native CacheStorage/IndexedDB proof in a new fictional app scope. */
export async function proveNativeOfflineShell() {
    const basePath = '/native-novel-shell-' + generateUUID() + '/', origin = location.origin
    const index = '<html><body>Fictional retained app</body></html>', script = 'console.log("fictional offline copy")'
    const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((n) => n.toString(16).padStart(2, '0')).join('')
    const manifest = async (id: string, large = false): Promise<ShellManifest> => {
        const assets = [{ path: basePath + 'index.html', bytes: new TextEncoder().encode(index).byteLength, sha256: await digest(index) },
            { path: basePath + 'assets/app.js', bytes: large ? 32 * 1024 * 1024 : new TextEncoder().encode(script).byteLength, sha256: await digest(script) }]
        return { schema: 1, id: await digest(id), buildId: id, basePath, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), assets }
    }
    let requests = 0, checks = 0
    const host = { location: { origin }, registration: { scope: origin + basePath }, caches, indexedDB, crypto,
        fetch: async (input: RequestInfo | URL) => {
            requests += 1
            const url = String(input), response = new Response(url.endsWith('index.html') ? index : script)
            Object.defineProperty(response, 'url', { value: url })
            return response
        } }
    const require = (condition: boolean, message: string) => { if (!condition) throw new Error(message); checks += 1 }
    const first = createShellRuntime(host, await manifest('native-first'))
    require((await first.prepare()).state === 'ready', 'Native app copy did not become ready')
    require((await first.status()).state === 'ready', 'Native app copy did not reopen')
    const request = new Request(origin + basePath)
    Object.defineProperty(request, 'mode', { value: 'navigate' })
    require(await (await first.respond(request)!).text() === index, 'Native navigation did not use the retained app')
    const before = requests
    const second = createShellRuntime(host, await manifest('native-incomplete-second', true)), third = createShellRuntime(host, await manifest('native-incomplete-third', true))
    const failed = await Promise.all([second.prepare(), third.prepare()])
    require(failed.filter((value) => value.reason === 'integrity').length === 1 && failed.filter((value) => value.reason === 'limit').length === 1, 'Concurrent reservations exceeded the app allowance')
    require(requests === before + 2, 'A refused reservation fetched app files')
    require((await first.status()).state === 'ready' && await (await first.respond(request)!).text() === index, 'A failed update changed the earlier complete app')
    const another = createShellRuntime({ ...host, registration: { scope: origin + '/another-app/' } }, await manifest('native-wrong-scope'))
    require((await another.prepare()).reason === 'integrity', 'A manifest escaped its registered app scope')
    require(first.respond(new Request(origin + basePath + 'auth/password/reset?token=fictional')) === null, 'An auth deep link was intercepted')
    require(first.respond(new Request(origin + basePath + 'version.json')) === null, 'The version check was intercepted')
    require(first.respond(new Request(origin + basePath + 'api/stories')) === null, 'An account API response was intercepted')
    return { checks, projectWrites: 0, removedRecords: 0, completeCopiesPreserved: 1, controlledConcurrentReservationBytes: 64 * 1024 * 1024 }
}
