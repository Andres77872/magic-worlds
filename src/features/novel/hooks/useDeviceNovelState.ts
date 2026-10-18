import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { subscribeDeviceReads } from '../persistence/deviceReadDatabase'
import { readDeviceNovel, type DeviceNovelScope, type DeviceNovelState } from '../persistence/deviceNovelStorage'
import { mergeNovelLifecycle } from '../persistence/novelDeviceLifecycle'

export function useDeviceNovelState(scope: DeviceNovelScope | null, current: () => boolean) {
    const key = scope ? JSON.stringify([scope.apiOrigin, scope.userHash, scope.workspaceId, scope.storyId]) : null
    const owner = useRef({ key, scope, current }), previous = useRef<{ key: string; value: DeviceNovelState } | null>(null)
    const [loaded, setLoaded] = useState<{ key: string; value: DeviceNovelState } | null>(null)
    useLayoutEffect(() => { owner.current = { key, scope, current } })
    useEffect(() => {
        if (!key || !owner.current.scope) return
        const captured = { ...owner.current.scope }
        let active = true, serial = 0
        const refresh = async () => {
            const ticket = ++serial, incoming = await readDeviceNovel(captured)
            if (!active || ticket !== serial || owner.current.key !== key || !owner.current.current()) return
            const old = previous.current?.key === key ? previous.current.value : null
            const value = { ...incoming, state: incoming.state ? mergeNovelLifecycle(old?.state ?? null, incoming.state) : old?.state ?? null,
                unreadable: incoming.unreadable || Boolean(old?.unreadable) }
            previous.current = { key, value }; setLoaded({ key, value })
        }
        void refresh()
        const unsubscribe = subscribeDeviceReads(() => { void refresh() })
        return () => { active = false; unsubscribe() }
    }, [key])
    return { data: loaded?.key === key && current() ? loaded.value : null, loading: key !== null && loaded?.key !== key }
}
