export type StorySourceKind =
    | 'blank'
    | 'character'
    | 'world'
    | 'item'
    | 'adventure_template'
    | 'adventure_session'

/** Canonical source returned on a hydrated story. */
export interface StorySource {
    kind: StorySourceKind
    id: string | null
    title: string | null
}

/** Source accepted when creating a story; omitted values use backend defaults. */
export interface StorySourceInput {
    kind: StorySourceKind
    id?: string | null
    title?: string | null
}

export type StoryCardKind =
    | 'character'
    | 'world'
    | 'item'
    | 'adventure_template'
    | 'lorebook'
    | 'lorebook_entry'
    | 'snapshot_card'

export type StoryCardRefSource = 'manual' | 'mention' | 'suggested' | 'source' | 'lore_activation'

export interface StorySnapshotCategory {
    name: string
    description: string
    attributes?: Array<Record<string, string>> | null
}

/** Exact immutable card body embedded in a story card reference. */
export interface StoryCardSnapshot {
    id: string
    name?: string | null
    alias?: string | null
    description: string
    race?: string | null
    type?: string | null
    category?: StorySnapshotCategory[] | null
    source_card_id?: string | null
    source_lorebook_id?: string | null
    source_card_version_id?: string | null
    source_card_version_number?: number | null
    story_card_kind: StoryCardKind
}

export interface StoryCardRef {
    id: string
    storyId: string
    chapterId: string | null
    kind: StoryCardKind
    cardId: string
    source: StoryCardRefSource
    enabled: boolean
    precedence: number
    snapshot: StoryCardSnapshot
    createdAt?: string
    updatedAt?: string
}

export interface StoryContextSettings {
    includeSelectedCards: boolean
    includeLorebooks: boolean
    includeRecentChapters: number
    tokenBudget: number
    styleSource: 'current_chapter' | 'whole_story' | 'card' | 'custom' | null
    customStyleInstruction: string | null
}

export interface StoryContextCardTrace {
    kind: StoryCardKind
    id: string
    title: string
    included: boolean
    reason: StoryCardRefSource
    estimatedTokens: number
    skippedReason: 'disabled' | null
}

export interface StoryContextLoreTrace {
    lorebookId: string
    entryId: string
    title: string
    included: boolean
    reason: StoryCardRefSource
    estimatedTokens: number
    skippedReason: 'disabled' | null
}

export interface StoryContextChapterTrace {
    chapterId: string
    title: string
    included: true
    reason: 'current' | 'recent'
    estimatedTokens: number
}

export interface StoryContextTrace {
    cards: StoryContextCardTrace[]
    loreEntries: StoryContextLoreTrace[]
    chapters: StoryContextChapterTrace[]
    totalEstimatedTokens: number
}

export type StoryGenerationCommand = 'continue' | 'rewrite' | 'expand' | 'condense' | 'describe' | 'critique' | 'custom'
export type StoryGenerationStatus = 'candidate' | 'accepted' | 'rejected' | 'stashed'

export interface StorySelection {
    startOffset: number
    endOffset: number
    text: string
}

export interface StoryGeneration {
    id: string
    storyId: string
    chapterId: string
    command: StoryGenerationCommand
    inputRange: StorySelection | null
    promptSummary: string | null
    contextTrace: StoryContextTrace
    output: string
    status: StoryGenerationStatus
    createdAt?: string
    updatedAt?: string
}

export type StoryChapterStatus = 'draft' | 'revising' | 'complete' | 'archived'

export interface StoryChapter {
    id: string
    storyId: string
    title: string
    body: string
    order: number
    status: StoryChapterStatus
    /** Optional per-chapter writing target persisted by the Story API. */
    wordGoal?: number | null
    povCardId: string | null
    locationCardId: string | null
    activeCardRefs: StoryCardRef[]
    generationHistory: StoryGeneration[]
    createdAt?: string
    updatedAt?: string
}

export interface Story {
    id: string
    title: string
    description: string | null
    source: StorySource
    chapters: StoryChapter[]
    activeCardRefs: StoryCardRef[]
    activeContext: StoryContextSettings
    createdAt?: string
    updatedAt?: string
}

export interface StoryChapterCreateRequest {
    title: string
    body?: string
    order?: number | null
    status?: StoryChapterStatus
    wordGoal?: number | null
    povCardId?: string | null
    locationCardId?: string | null
}

export interface StoryCreateRequest {
    title: string
    description?: string | null
    source?: StorySourceInput
    chapters: StoryChapterCreateRequest[]
    cardRefs?: Array<{
        kind: StoryCardKind
        cardId: string
        source?: StoryCardRefSource
        enabled?: boolean
        precedence?: number
        chapterId?: string | null
        snapshot?: StoryCardSnapshot | null
    }>
    activeContext?: StoryContextSettings
}

export interface StoryGenerateRequest {
    chapterId: string
    command: StoryGenerationCommand
    selection?: StorySelection
    instruction?: string
    contextSettings?: StoryContextSettings
}

export interface StoryGenerateResponse {
    generation: StoryGeneration
    chapter: StoryChapter
    stagedCardUpdates: unknown[]
}
