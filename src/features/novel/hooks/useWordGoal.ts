/** Persist a per-chapter word target through the stored Story chapter API. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, useData } from '@/app/hooks'
import type { StoryChapter } from '@/shared'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import type { StoryWorkspace } from './useStoryWorkspace'

const KEY_PREFIX = 'magic_worlds:novel:wordGoal'
const MAX_WORD_GOAL = 2_147_483_647

function storageKey(storyId: string | null, chapterId: string | null): string | null {
    if (!storyId || !chapterId) return null
    return `${KEY_PREFIX}:${storyId}:${chapterId}`
}

function normalizeGoal(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    const rounded = Math.round(value)
    return rounded > 0 && rounded <= MAX_WORD_GOAL ? rounded : null
}

function readLegacyGoal(key: string | null): number | null {
    if (!key) return null
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return null
        return normalizeGoal(Number(raw))
    } catch {
        return null
    }
}

function removeLegacyGoal(key: string | null): void {
    if (!key) return
    try {
        window.localStorage.removeItem(key)
    } catch {
        // A successful server save remains authoritative if storage is unavailable.
    }
}

export interface WordGoalApi {
    goal: number | null
    /** Resolves true only when the stored chapter update succeeds. */
    setGoal: (goal: number | null) => Promise<boolean>
}

/**
 * `workspace`: the open story's workspace; updates only start (and land in the
 * UI) while it is current, and never while it is archived (read-only: the goal
 * still shows, nothing is written — not even a legacy migration).
 */
export function useWordGoal(
    storyId: string | null,
    chapter: StoryChapter | null,
    workspace: Pick<StoryWorkspace, 'isCurrent'> & { workspaceId?: string | null },
): WordGoalApi {
    const { updateStoryChapter } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()
    const readOnly = useWorkspaceReadOnly(workspace.workspaceId)
    const chapterId = chapter?.id ?? null
    const key = storageKey(storyId, chapterId)
    const identity = storyId && chapterId ? `${storyId}:${chapterId}` : null
    const [goal, setGoalState] = useState<number | null>(() => normalizeGoal(chapter?.wordGoal))
    const currentIdentityRef = useRef(identity)
    const goalRef = useRef(goal)
    const requestVersionRef = useRef(0)
    const migrationStartedRef = useRef(new Set<string>())
    const migrationPromiseRef = useRef<{ identity: string; promise: Promise<void> } | null>(null)
    const workspaceRef = useRef(workspace)
    useEffect(() => {
        workspaceRef.current = workspace
    })

    if (currentIdentityRef.current !== identity) {
        currentIdentityRef.current = identity
        requestVersionRef.current += 1
    }
    goalRef.current = goal

    // Hydrate from the server. A legacy browser value is migrated once, but its
    // key is removed only after the chapter update succeeds.
    useEffect(() => {
        const serverGoal = normalizeGoal(chapter?.wordGoal)
        setGoalState(serverGoal)
        goalRef.current = serverGoal
        if (!identity || !storyId || !chapterId || serverGoal !== null || !isAuthenticated || !workspaceRef.current.isCurrent()) return

        const legacyGoal = readLegacyGoal(key)
        if (legacyGoal === null) return
        setGoalState(legacyGoal)
        goalRef.current = legacyGoal
        // Read-only: show the browser's goal, but it stays there until a restore lets it migrate.
        if (readOnly || migrationStartedRef.current.has(identity)) return

        migrationStartedRef.current.add(identity)
        const requestVersion = ++requestVersionRef.current
        const promise = updateStoryChapter(storyId, chapterId, { wordGoal: legacyGoal })
            .then((updated) => {
                removeLegacyGoal(key)
                if (currentIdentityRef.current !== identity || requestVersionRef.current !== requestVersion || !workspaceRef.current.isCurrent()) return
                const persisted = normalizeGoal(updated?.wordGoal) ?? legacyGoal
                goalRef.current = persisted
                setGoalState(persisted)
            })
            .catch((error) => {
                migrationStartedRef.current.delete(identity)
                console.error('Failed to migrate chapter word goal:', error)
            })
            .finally(() => {
                if (migrationPromiseRef.current?.identity === identity) migrationPromiseRef.current = null
            })
        migrationPromiseRef.current = { identity, promise }
    }, [chapter?.wordGoal, chapterId, identity, isAuthenticated, key, readOnly, storyId, updateStoryChapter])

    const setGoal = useCallback(
        async (next: number | null): Promise<boolean> => {
            if (!identity || !storyId || !chapterId || readOnly) return false
            if (!isAuthenticated) {
                openLoginModal()
                return false
            }
            if (!workspaceRef.current.isCurrent()) return false
            const normalized = normalizeGoal(next)
            if (next !== null && normalized === null) {
                console.error('Failed to save chapter word goal: value is outside the supported range.')
                return false
            }
            const previous = goalRef.current
            const requestVersion = ++requestVersionRef.current
            goalRef.current = normalized
            setGoalState(normalized)

            const migration = migrationPromiseRef.current
            try {
                if (migration?.identity === identity) await migration.promise
                const updated = await updateStoryChapter(storyId, chapterId, { wordGoal: normalized })
                removeLegacyGoal(key)
                if (currentIdentityRef.current === identity && requestVersionRef.current === requestVersion && workspaceRef.current.isCurrent()) {
                    const persisted = normalizeGoal(updated?.wordGoal)
                    goalRef.current = persisted
                    setGoalState(persisted)
                }
                return true
            } catch (error) {
                console.error('Failed to save chapter word goal:', error)
                if (currentIdentityRef.current === identity && requestVersionRef.current === requestVersion && workspaceRef.current.isCurrent()) {
                    goalRef.current = previous
                    setGoalState(previous)
                }
                return false
            }
        },
        [chapterId, identity, isAuthenticated, key, openLoginModal, readOnly, storyId, updateStoryChapter],
    )

    return { goal, setGoal }
}
