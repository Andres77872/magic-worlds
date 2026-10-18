import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StoryOutline } from '@/shared'
import type { AccountStorageScope } from '@/shared/workspaceStorage'
import { rememberDeviceNovelErased, rememberDeviceNovelRoot, rememberDeviceNovelSource, type NovelRetentionStatus } from '../persistence/deviceNovelStorage'

interface Owner { key: string; scope: (AccountStorageScope & { workspaceId: string }) | null; current: () => boolean; observationsCurrent?: () => boolean }
/** Retains checked account observations independently of whether Studio is open. */
export function useNovelLifecycleRetention(owner: Owner, stories: readonly StoryOutline[], active: StoryOutline | null) {
    const key = JSON.stringify([owner.key, owner.scope]), live = useRef({ owner, key }), sequence = useRef(0), mounted = useRef(true)
    const [status, setStatus] = useState<{ key: string; failed: boolean } | null>(null)
    useLayoutEffect(() => { live.current = { owner, key } })
    useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
    useEffect(() => {
        const { owner: captured } = live.current, ticket = ++sequence.current
        if (!captured.scope || !captured.current() || captured.observationsCurrent?.() === false) return
        const current = () => mounted.current && live.current.key === key && captured.current() && captured.observationsCurrent?.() !== false
        const work = (active ? [...stories, active] : stories).filter((source) => source.organization?.workspace_id === captured.scope!.workspaceId)
            .map((source) => rememberDeviceNovelSource({ ...captured.scope!, storyId: source.id }, source, current))
        void Promise.all(work).then((results) => {
            const failed = results.some((result) => result.status !== 'saved' && result.status !== 'retired')
            if (current() && ticket === sequence.current) setStatus((old) => old?.key === key && old.failed === failed ? old : { key, failed })
        })
    }, [key, stories, active])
    const current = () => mounted.current && live.current.key === key && owner.current()
    const reported = async (pending: Promise<{ status: NovelRetentionStatus }>) => {
        const result = await pending
        if (current() && result.status !== 'saved' && result.status !== 'retired') setStatus((old) => old?.key === key && old.failed ? old : { key, failed: true })
        return result
    }
    return {
        failed: status?.key === key && status.failed,
        root: (storyId: string, revision: number, readOnly: boolean) => {
            if (!owner.scope || !current()) return Promise.resolve({ status: 'retired' as const })
            sequence.current += 1
            return reported(rememberDeviceNovelRoot({ ...owner.scope, storyId }, revision, readOnly, current))
        },
        erased: (storyId: string) => {
            if (!owner.scope || !current()) return Promise.resolve({ status: 'retired' as const })
            sequence.current += 1
            return reported(rememberDeviceNovelErased({ ...owner.scope, storyId }, current))
        },
    }
}
