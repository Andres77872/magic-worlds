export const DEVICE_READ_STORE = 'novels', DEVICE_READ_METADATA = 'usage'
const DATABASE = 'magic-worlds-novel-confirmed-reads-v1'
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
const local = () => { for (const listener of listeners) listener() }
const focused = () => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') local() }

/** Same version/stores as earlier app copies; lifecycle rows have separate keys. */
export function openDeviceReadDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('Device storage unavailable')); return }
        const request = indexedDB.open(DATABASE, 1)
        let settled = false
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(DEVICE_READ_STORE)) request.result.createObjectStore(DEVICE_READ_STORE, { keyPath: 'key' })
            if (!request.result.objectStoreNames.contains(DEVICE_READ_METADATA)) request.result.createObjectStore(DEVICE_READ_METADATA, { keyPath: 'key' })
        }
        request.onerror = () => { settled = true; reject(request.error) }
        request.onblocked = () => { settled = true; reject(new Error('Device storage is busy')) }
        request.onsuccess = () => {
            const db = request.result
            if (settled) { db.close(); return }
            db.onversionchange = () => db.close(); resolve(db)
        }
    })
}
export function notifyDeviceReads() {
    local()
    try {
        if (typeof BroadcastChannel === 'undefined') return
        const target = channel ?? new BroadcastChannel('magic-worlds-novel-device-state-v1')
        target.postMessage('changed')
        if (!channel) target.close()
    } catch { /* Focus/reopen still rereads the retained native state. */ }
}
export function subscribeDeviceReads(listener: () => void) {
    listeners.add(listener)
    if (listeners.size === 1) {
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                channel = new BroadcastChannel('magic-worlds-novel-device-state-v1')
                channel.onmessage = (event: MessageEvent<unknown>) => { if (event.data === 'changed') local() }
            }
        } catch { channel = null }
        window.addEventListener('focus', focused); document.addEventListener('visibilitychange', focused)
    }
    return () => {
        listeners.delete(listener)
        if (!listeners.size) {
            channel?.close(); channel = null
            window.removeEventListener('focus', focused); document.removeEventListener('visibilitychange', focused)
        }
    }
}
