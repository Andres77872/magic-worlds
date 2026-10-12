/**
 * The workspace's flat collections (position/created_at/id order), loaded once
 * per workspace — never one request per folder. `card_count` comes from the
 * server aggregate. A per-workspace cache lets the Library show its folders
 * immediately when it remounts (returning from a creator) while it revalidates.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import type { ApiService } from '@/infrastructure/api'
import type { Collection } from '@/shared/types'

const cache = new Map<string, readonly Collection[]>()

interface CollectionsState {
    workspaceId: string | null
    items: readonly Collection[]
    loading: boolean
    error: boolean
}

export interface LibraryCollections {
    collections: readonly Collection[]
    loading: boolean
    error: boolean
    refresh: () => Promise<void>
    /** Applies a created/updated collection locally (keeps server order for existing ones). */
    upsert: (collection: Collection) => void
    remove: (collectionId: string) => void
}

/** Drops a workspace's cached collections (e.g. after copies landed in its collections). */
export function forgetLibraryCollections(workspaceId: string): void {
    cache.delete(workspaceId)
}

function sortCollections(items: readonly Collection[]): Collection[] {
    return [...items].sort((a, b) => a.position - b.position
        || a.created_at.localeCompare(b.created_at)
        || a.id.localeCompare(b.id))
}

export function useLibraryCollections(api: ApiService | null, workspaceId: string | null): LibraryCollections {
    const { capture, isCurrent } = useWorkspace()
    const [state, setState] = useState<CollectionsState>(() => ({
        workspaceId,
        items: (workspaceId && cache.get(workspaceId)) || [],
        loading: Boolean(workspaceId && !cache.has(workspaceId)),
        error: false,
    }))
    const requestRef = useRef(0)

    const load = useCallback(async () => {
        if (!api || !workspaceId) return
        const request = (requestRef.current += 1)
        const scope = capture()
        setState((current) => ({
            workspaceId,
            items: current.workspaceId === workspaceId ? current.items : (cache.get(workspaceId) ?? []),
            loading: current.workspaceId !== workspaceId ? !cache.has(workspaceId) : current.items.length === 0,
            error: false,
        }))
        try {
            const list = await api.listCollections(workspaceId)
            if (request !== requestRef.current || !isCurrent(scope)) return
            const items = sortCollections(list.items)
            cache.set(workspaceId, items)
            setState({ workspaceId, items, loading: false, error: false })
        } catch {
            if (request !== requestRef.current || !isCurrent(scope)) return
            setState((current) => ({ ...current, workspaceId, loading: false, error: true }))
        }
    }, [api, capture, isCurrent, workspaceId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])

    const update = useCallback((next: (items: readonly Collection[]) => Collection[]) => {
        setState((current) => {
            if (!current.workspaceId) return current
            const items = next(current.items)
            cache.set(current.workspaceId, items)
            return { ...current, items }
        })
    }, [])

    const upsert = useCallback((collection: Collection) => {
        update((items) => {
            const index = items.findIndex((item) => item.id === collection.id)
            return index === -1
                ? sortCollections([...items, collection])
                : items.map((item, position) => (position === index ? collection : item))
        })
    }, [update])

    const remove = useCallback((collectionId: string) => {
        update((items) => items.filter((item) => item.id !== collectionId))
    }, [update])

    const owned = state.workspaceId === workspaceId
    return {
        collections: owned ? state.items : [],
        loading: owned ? state.loading : Boolean(workspaceId),
        error: owned && state.error,
        refresh: load,
        upsert,
        remove,
    }
}
