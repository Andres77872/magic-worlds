import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { transformWithOxc, type Plugin } from 'vite'
import type { ShellAsset, ShellManifest } from '../src/app/offline/shellProtocol'

const publicAssets = ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon-180.png', 'og-image.png', 'site.webmanifest']
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')

export function offlineShellPlugin(buildId: string): Plugin {
    let root: string, basePath: string, publicDir: string | false
    return {
        name: 'magic-worlds-offline-shell', apply: 'build', enforce: 'post',
        configResolved(config) { root = config.root; basePath = config.base; publicDir = config.publicDir },
        generateBundle: {
            order: 'post',
            async handler(_options, bundle) {
                if (!basePath.startsWith('/') || basePath.startsWith('//') || !basePath.endsWith('/') || /[?#]/.test(basePath)) this.error('Offline app copies require an absolute same-origin base path.')
                const files = new Map<string, Uint8Array>()
                for (const [name, output] of Object.entries(bundle)) {
                    if (name !== 'index.html' && !name.startsWith('assets/')) continue
                    if (name !== 'index.html' && !/\.(?:js|css|svg|png|jpe?g|webp|avif|ico|woff2?|ttf)$/.test(name)) continue
                    const source = output.type === 'chunk' ? output.code : output.source
                    files.set(name, typeof source === 'string' ? new TextEncoder().encode(source) : source)
                }
                if (publicDir) for (const name of publicAssets) {
                    try { files.set(name, await readFile(resolve(publicDir, name))) } catch (error) {
                        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
                    }
                }
                if (!files.has('index.html')) this.error('Offline app manifest requires the final app entry.')
                const assets: ShellAsset[] = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => ({ path: basePath + name, bytes: bytes.byteLength, sha256: hash(bytes) }))
                const description = { schema: 1 as const, buildId, basePath, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), assets }
                const manifest: ShellManifest = { ...description, id: hash(JSON.stringify(description)) }
                const runtime = await transformWithOxc(await readFile(resolve(root, 'src/app/offline/shellWorkerRuntime.ts'), 'utf8'), 'shellWorkerRuntime.ts', { sourcemap: false })
                if (/^\s*import\s/m.test(runtime.code)) this.error('Offline worker must not import app modules.')
                const bootstrap = `\nconst runtime = createShellRuntime(self, ${JSON.stringify(manifest)});\nself.addEventListener('install', event => event.waitUntil(runtime.prepare().then(value => { if (value.state !== 'ready') throw new Error(value.reason || 'Offline app unavailable'); })));\nself.addEventListener('activate', event => event.waitUntil(self.clients.claim()));\nself.addEventListener('fetch', event => { const response = runtime.respond(event.request); if (response) event.respondWith(response); });\nself.addEventListener('message', event => { if (!event.ports[0]) return; event.waitUntil(runtime.message(event.source?.url, event.data).then(value => { if (value) event.ports[0].postMessage(value); })); });\n`
                this.emitFile({ type: 'asset', fileName: 'novel-offline-worker.js', source: runtime.code + bootstrap })
            },
        },
    }
}
