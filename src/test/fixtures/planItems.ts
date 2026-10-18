import { vi } from 'vitest'
import type { StoryPlanItem, StoryPlanKind } from '@/shared'
import type { PlanItems } from '@/features/novel/hooks/usePlanItems'

let sequence = 0
export function planItem<K extends StoryPlanKind>(kind: K, data: StoryPlanItem<K>['data'], patch: Partial<StoryPlanItem<K>> = {}): StoryPlanItem<K> {
    const initial = { task: 'open', fact: 'proposed', stash: 'kept' }[kind] as StoryPlanItem<K>['state']
    return { id: `${kind}-${++sequence}`, storyId: 'story-1', kind, state: initial, sceneId: null, revision: 1, data,
        createdAt: '2026-10-17T10:00:00Z', updatedAt: '2026-10-17T10:00:00Z', ...patch }
}

/** A controllable in-memory list; `rerender` must be called after writes to see them. */
export function planItems<K extends StoryPlanKind>(kind: K, items: StoryPlanItem<K>[] = []): PlanItems<K> & { items: StoryPlanItem<K>[] } {
    const value = {
        items, loading: false, error: false, truncated: false,
        refresh: vi.fn(async () => {}),
        create: vi.fn(async (data: StoryPlanItem<K>['data'], state?: StoryPlanItem<K>['state']) => {
            const created = planItem(kind, data, state ? { state } : {})
            value.items = [created, ...value.items]
            return created
        }),
        update: vi.fn(async (item: StoryPlanItem<K>, change: { state?: StoryPlanItem<K>['state']; data?: StoryPlanItem<K>['data'] }) => {
            const updated = { ...item, ...change, data: change.data ?? item.data, revision: item.revision + 1 }
            value.items = value.items.map((row) => row.id === item.id ? updated : row)
            return updated
        }),
    }
    return value
}
