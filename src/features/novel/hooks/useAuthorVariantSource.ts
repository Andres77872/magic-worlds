import { useLayoutEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/app/hooks'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { ApiError } from '@/infrastructure/api'
import { apiStorageOrigin } from '@/shared/workspaceStorage'
import { canonicalJson } from '@/utils/json'
import { documentSignature } from '@/shared/storyDocument'
import type { StoryOutline, StoryVariantCreate, StoryVariantDecision, StoryVariantIntent, StoryVariantQuery, StoryVariantRecord, StoryVariantSnapshot } from '@/shared'
import { verifyStoryVariantSnapshot, storyVariantReference } from '@/infrastructure/api/storyVariantContract'
import { isAuthorVariantContext } from '../persistence/authorVariantJournal'
import type { StoryWorkspace } from './useStoryWorkspace'

export const variantSnapshotIntent = (v: StoryVariantSnapshot): StoryVariantIntent => ({ id: v.id, title: v.title,
    parent: { generationId: v.parent.parent.id, parentHash: v.parent.parentHash }, operation: structuredClone(v.operation) })
export function authorVariantTargetReadOnly(story:StoryOutline|null,sceneId:string|null,workspaceReadOnly:boolean):boolean {
    const scene=story?.chapters.flatMap(chapter=>chapter.scenes).find(row=>row.id===sceneId)
    return workspaceReadOnly||!story||story.status==='archived'||Boolean(story.trashedAt)||!scene
        ||Boolean(scene.inheritance?.readOnly||scene.trashedAt||scene.mergedInto)||scene.status==='archived'
}
export function useAuthorVariantSource(storyId: string | null, workspace: StoryWorkspace) {
    const { userHash, accountKey } = useAuth()
    const key = storyId && userHash && workspace.workspaceId ? JSON.stringify([apiStorageOrigin(API_BASE_URL), accountKey, userHash, workspace.workspaceId, storyId]) : null
    const owner = useMemo(() => ({ key }), [key]), live = useRef<typeof owner | null>(owner)
    useLayoutEffect(() => { live.current = owner; return () => { if (live.current === owner) live.current = null } }, [owner])
    return useMemo(() => {
        if (!key || !storyId || !userHash || !workspace.workspaceId) return null
        const isCurrent = () => live.current === owner && workspace.isCurrent()
        const client = () => { const api = isCurrent() ? workspace.detachedApi() : null; if (!api) throw new Error('Authored version scope changed'); return api }
        const changed = () => new ApiError(409, 'The original suggestion or saved sources changed.', { code: 'STORY_VARIANT_BASE_CHANGED', retryable: false })
        return { key, storyId, scope: { userHash, workspaceId: workspace.workspaceId, storyId }, isCurrent,
            async context(generationId: string, signal: AbortSignal) {
                const api = client(), [detail, parent] = await Promise.all([api.getStoryGenerationHistoryDetail(storyId, generationId, { signal }), api.getStoryRefinementParent(storyId, generationId, { signal })])
                signal.throwIfAborted(); client()
                const p = parent.parent, g = detail.generation
                if (detail.location !== 'active' || !['candidate', 'stashed'].includes(g.status) || p.id !== g.id || p.sceneId !== g.sceneId
                    || p.chapterId !== g.chapterId || p.baseRevision !== g.baseRevision || p.command !== g.command || p.output !== g.output || p.instruction !== (g.instruction ?? null)) throw changed()
                const document = await api.getStorySceneDocument(storyId, p.sceneId)
                signal.throwIfAborted(); client()
                const scene = document
                const result = { parent, baseDocument: scene.document, baseContentHash: scene.contentHash, inputRange: g.inputRange, chapterTitle: detail.chapterTitle, sceneTitle: detail.sceneTitle }
                if (scene.revision !== p.baseRevision || scene.inheritance?.readOnly || scene.trashedAt || scene.status === 'archived' || scene.mergedInto || !isAuthorVariantContext(result, storyId)) throw changed()
                return result
            },
            preview: (intent: StoryVariantIntent, signal: AbortSignal) => client().previewStoryVariant(storyId, intent, { signal }),
            create: (write: StoryVariantCreate, signal: AbortSignal) => client().createStoryVariant(storyId, write, { signal }),
            decide: (write: StoryVariantDecision, signal: AbortSignal) => client().decideStoryVariant(storyId, write, { signal }),
            result: (write: StoryVariantCreate | StoryVariantDecision, signal: AbortSignal) => client().getStoryVariantResult(storyId, write, { signal }),
            read: (id: string, signal: AbortSignal) => client().getStoryVariant(storyId, id, { signal }),
            page: (query: StoryVariantQuery, signal: AbortSignal) => client().getStoryVariants(storyId, query, { signal }),
            async review(record: StoryVariantRecord, signal: AbortSignal) {
                const api = client(), v = record.variant
                if (!verifyStoryVariantSnapshot(v, storyId)) throw changed()
                const before = await api.getStoryStudioIndex(storyId, { signal })
                const fresh = await api.getStoryVariant(storyId, v.id, { signal })
                if (!['candidate', 'stashed'].includes(fresh.status) || canonicalJson(storyVariantReference(fresh.variant)) !== canonicalJson(storyVariantReference(v))
                    || canonicalJson(fresh.variant) !== canonicalJson(v)) throw changed()
                const preview = await api.previewStoryVariant(storyId, variantSnapshotIntent(v), { signal })
                const [index, detail] = await Promise.all([api.getStoryStudioIndex(storyId, { signal }), api.getStoryGenerationHistoryDetail(storyId, v.parent.parent.id, { signal })])
                signal.throwIfAborted(); client()
                const head = index.chapters.flatMap(chapter => chapter.scenes).find(scene => scene.id === v.operation.sceneId), g = detail.generation, p = v.parent.parent
                if (before.sourceVersion !== index.sourceVersion || index.status === 'archived' || index.trashedAt || !head || head.inheritance?.readOnly || head.trashedAt
                    || head.revision !== v.operation.expectedRevision || head.contentHash !== v.operation.expectedContentHash || canonicalJson(preview) !== canonicalJson(v)
                    || detail.location !== 'active' || !['candidate', 'stashed'].includes(g.status) || g.id !== p.id || g.sceneId !== p.sceneId || g.chapterId !== p.chapterId
                    || g.baseRevision !== p.baseRevision || g.command !== p.command || g.output !== p.output || (g.instruction ?? null) !== p.instruction) throw changed()
                return { index, detail, variant: fresh.variant, documentSignature: documentSignature(v.baseDocument) }
            },
        }
    }, [key, owner, storyId, userHash, workspace])
}
export type AuthorVariantSource = NonNullable<ReturnType<typeof useAuthorVariantSource>>
