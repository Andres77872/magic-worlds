import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AccountStorageScope } from '@/shared/workspaceStorage'
import { canonicalJson } from '@/utils/json'
import { subscribeDeviceReads } from '../persistence/deviceReadDatabase'
import { listDeviceWorkspaces, newestCachedWorkspace, type DeviceWorkspaceStates } from '../persistence/deviceWorkspaceStorage'

/** A failed refresh cannot remove a restriction already observed by this view. */
export function retainDeviceWorkspaceStates(previous: DeviceWorkspaceStates | null, incoming: DeviceWorkspaceStates): DeviceWorkspaceStates {
    const states = Object.assign(Object.create(null), previous?.states) as DeviceWorkspaceStates['states']
    const unreadable = new Set(previous?.unreadableIds ?? [])
    for (const id of incoming.unreadableIds) unreadable.add(id)
    for (const [id, workspace] of Object.entries(incoming.states)) {
        states[id] = newestCachedWorkspace(states[id], workspace)
        if (canonicalJson(states[id]) === canonicalJson(workspace)) unreadable.delete(id)
    }
    return { ...incoming, states, unreadableIds: [...unreadable], unreadable: Math.max(incoming.unreadable, unreadable.size) }
}
export function useDeviceWorkspaceStates(scope: AccountStorageScope, current: () => boolean, enabled = true) {
    const key = JSON.stringify([scope.apiOrigin, scope.userHash]), owner = useRef({ key, scope, current })
    const [loaded, setLoaded] = useState<{ key: string; data: DeviceWorkspaceStates } | null>(null)
    const last = useRef<{ key: string; data: DeviceWorkspaceStates } | null>(null)
    useLayoutEffect(() => { owner.current = { key, scope, current } })
    useEffect(() => {
        if (!enabled) return
        let active = true, sequence = 0
        const captured = owner.current.scope
        const refresh = async () => {
            const ticket = ++sequence, incoming = await listDeviceWorkspaces(captured)
            if (!active || ticket !== sequence || owner.current.key !== key || !owner.current.current()) return
            const data = retainDeviceWorkspaceStates(last.current?.key === key ? last.current.data : null, incoming)
            last.current = { key, data }; setLoaded({ key, data })
        }
        void refresh()
        const unsubscribe = subscribeDeviceReads(() => { void refresh() })
        return () => { active = false; unsubscribe() }
    }, [key, enabled])
    const data = loaded?.key === key && current() ? loaded.data : null
    return { data, loading: enabled && data === null }
}
