/**
 * Planning items (tasks, facts, stash) for the open story's workspace. Reads and
 * writes go through `detachedApi()`, so a late answer never lands in another
 * workspace; a write whose answer was lost is recovered from its receipt once
 * before it is reported as failed.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { ApiError } from '@/infrastructure/api'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import type { StoryPlanAcknowledgement, StoryPlanItem, StoryPlanKind, StoryPlanOperation, StoryPlanQuery, StoryPlanPage } from '@/shared/types/storyPlanning.types'
import { makeRequestId } from '@/utils/uuid'
import type { StoryWorkspace } from './useStoryWorkspace'

export interface PlanItemsSource {
    key: string
    storyId: string
    isCurrent: () => boolean
    list: <K extends StoryPlanKind>(kind: K, query?: StoryPlanQuery) => Promise<StoryPlanPage<K>>
    write: <K extends StoryPlanKind>(operation: StoryPlanOperation<K>) => Promise<StoryPlanAcknowledgement<K>>
}

/** A lost answer (network failure or a retryable server error) may still have been committed. */
const unanswered = (error: unknown) => error instanceof TypeError || error instanceof ApiError && (error.status === 0 || error.status >= 500 && error.retryable !== false)

export function usePlanItemsSource(storyId: string | null, workspace: StoryWorkspace): PlanItemsSource | null {
    const { userHash } = useAuth()
    const key = storyId && userHash && workspace.workspaceId ? JSON.stringify([API_BASE_URL, userHash, workspace.workspaceId, storyId, 'plan']) : null
    const token = useMemo(() => ({ key, workspace }), [key, workspace]), live = useRef<object | null>(token)
    useLayoutEffect(() => { live.current = token; return () => { live.current = null } }, [token])
    return useMemo(() => {
        if (!key || !storyId) return null
        const isCurrent = () => live.current === token && workspace.isCurrent() && !workspace.deviceOnly
        const api = () => { const value = isCurrent() ? workspace.detachedApi() : null; if (!value) throw new Error('Planning scope changed'); return value }
        return {
            key, storyId, isCurrent,
            list: async (kind, query = {}) => { const value = await api().listStoryPlanItems(storyId, kind, query); api(); return value },
            write: async (operation) => {
                const write = { requestId: makeRequestId('mw-plan'), operation }
                try {
                    const value = await api().changeStoryPlanItem(storyId, write); api(); return value
                } catch (error) {
                    if (!unanswered(error)) throw error
                    const recovered = await api().getStoryPlanItemResult(storyId, write)
                    api()
                    if (!recovered) throw error
                    return recovered
                }
            },
        }
    }, [key, storyId, workspace, token])
}

export interface PlanItems<K extends StoryPlanKind> {
    items: StoryPlanItem<K>[]
    loading: boolean
    error: boolean
    truncated: boolean
    refresh: () => Promise<void>
    create: (data: StoryPlanItem<K>['data'], state?: StoryPlanItem<K>['state']) => Promise<StoryPlanItem<K>>
    update: (item: StoryPlanItem<K>, change: { state?: StoryPlanItem<K>['state']; data?: StoryPlanItem<K>['data'] }) => Promise<StoryPlanItem<K>>
}

/** The live list of one kind; it loads while `enabled` and follows each acknowledged write. */
export function usePlanItems<K extends StoryPlanKind>(source: PlanItemsSource | null, kind: K, enabled: boolean): PlanItems<K> {
    const [state, setState] = useState<{ key: string | null; items: StoryPlanItem<K>[]; loading: boolean; error: boolean; truncated: boolean }>({ key: null, items: [], loading: false, error: false, truncated: false })
    const key = source?.key ?? null
    const refresh = useCallback(async () => {
        if (!source?.isCurrent()) return
        setState(old => ({ ...old, key: source.key, loading: true, error: false, items: old.key === source.key ? old.items : [] }))
        try {
            const page = await source.list(kind)
            if (source.isCurrent()) setState({ key: source.key, items: page.items, loading: false, error: false, truncated: page.truncated })
        } catch {
            if (source.isCurrent()) setState(old => ({ ...old, loading: false, error: true }))
        }
    }, [source, kind])
    useEffect(() => {
        // Loading starts after the render that enabled it; results land through refresh.
        if (enabled && key) queueMicrotask(() => void refresh())
    }, [enabled, key, refresh])
    const accept = (value: StoryPlanItem<K>) => {
        if (source?.isCurrent()) setState(old => old.key !== source.key ? old : { ...old, items: [value, ...old.items.filter(item => item.id !== value.id)] })
        return value
    }
    return {
        items: state.key === key ? state.items : [],
        loading: state.key === key && state.loading,
        error: state.key === key && state.error,
        truncated: state.key === key && state.truncated,
        refresh,
        create: async (data, initial) => {
            if (!source) throw new Error('Planning is unavailable')
            const ack = await source.write<K>({ op: 'create', id: makeRequestId('mw-plan-item'), kind, ...(initial ? { state: initial } : {}), data })
            return accept(ack.item)
        },
        update: async (item, change) => {
            if (!source) throw new Error('Planning is unavailable')
            const ack = await source.write<K>({ op: 'update', id: item.id, kind, expectedRevision: item.revision, ...change })
            return accept(ack.item)
        },
    }
}
