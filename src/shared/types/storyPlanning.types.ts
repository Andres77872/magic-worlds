/** Planning items: passage-linked revision tasks, time-scoped story facts and a cut/take stash. */

export type StoryPlanKind = 'task' | 'fact' | 'stash'
export type StoryTaskState = 'open' | 'done' | 'dismissed' | 'trashed'
export type StoryFactState = 'proposed' | 'approved' | 'rejected' | 'trashed'
export type StoryStashState = 'kept' | 'trashed'
export type StoryFactKind = 'knowledge' | 'relationship' | 'possession' | 'location' | 'state' | 'trait' | 'event'

export interface StoryTaskData {
    title: string
    body?: string
    sceneId?: string
    quote?: string
    sourceRevision?: number
    resolution?: string
    origin: 'author' | 'continuity' | 'critique' | 'plan'
    originRef?: string
}
export interface StoryFactData {
    subject: string
    subjectCardId?: string
    kind: StoryFactKind
    statement: string
    object?: string
    /** Holds from this scene (reading order); absent means from the beginning. */
    fromSceneId?: string
    /** Stops holding at this scene; absent means until the end. */
    untilSceneId?: string
    sourceSceneId?: string
    quote?: string
    sourceRevision?: number
    origin: 'author' | 'assistant'
    originRef?: string
    /** The novel Codex entry the author applied this fact to, and the context revision that write produced. */
    codexRefId?: string
    codexRevision?: number
}
export interface StoryStashData {
    kind: 'cut' | 'take'
    title: string
    text: string
    sceneId?: string
    sourceRevision?: number
}
export interface StoryPlanDataMap { task: StoryTaskData; fact: StoryFactData; stash: StoryStashData }
export interface StoryPlanStateMap { task: StoryTaskState; fact: StoryFactState; stash: StoryStashState }

export interface StoryPlanItem<K extends StoryPlanKind = StoryPlanKind> {
    id: string
    storyId: string
    kind: K
    state: StoryPlanStateMap[K]
    sceneId: string | null
    revision: number
    data: StoryPlanDataMap[K]
    createdAt: string
    updatedAt: string
}
export interface StoryPlanPage<K extends StoryPlanKind = StoryPlanKind> {
    storyId: string
    kind: K
    items: StoryPlanItem<K>[]
    truncated: boolean
}
export interface StoryPlanQuery {
    state?: string
    sceneId?: string
    q?: string
    includeTrashed?: boolean
}
export type StoryPlanOperation<K extends StoryPlanKind = StoryPlanKind> =
    | { op: 'create'; id: string; kind: K; state?: StoryPlanStateMap[K]; data: StoryPlanDataMap[K] }
    | { op: 'update'; id: string; kind: K; expectedRevision: number; state?: StoryPlanStateMap[K]; data?: StoryPlanDataMap[K] }
export interface StoryPlanWrite<K extends StoryPlanKind = StoryPlanKind> {
    requestId: string
    operation: StoryPlanOperation<K>
}
export interface StoryPlanAcknowledgement<K extends StoryPlanKind = StoryPlanKind> {
    kind: 'plan_item'
    storyId: string
    requestId: string
    item: StoryPlanItem<K>
}
