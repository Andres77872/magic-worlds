export type StorySourceKind =
    | 'blank'
    | 'character'
    | 'world'
    | 'item'
    | 'adventure_template'
    | 'adventure_session'
    | 'character_chat'
    | 'lorebook'

export interface StorySource {
    kind: StorySourceKind
    id?: string | null
    title?: string | null
    snapshotId?: string | null
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

export interface StoryCardRef {
    id: string
    storyId: string
    chapterId?: string | null
    kind: StoryCardKind
    cardId: string
    source: StoryCardRefSource
    enabled: boolean
    precedence: number
    snapshot?: Record<string, unknown> | null
    createdAt?: string
    updatedAt?: string
}

export interface StoryMentionRef {
    id: string
    sceneId: string
    cardKind: StoryCardKind
    cardId: string
    matchedText: string
    matchSource: 'name' | 'alias' | 'trigger' | 'manual'
    startOffset: number
    endOffset: number
    confidence: 'exact' | 'likely' | 'manual'
}

export interface StoryContextSettings {
    includeSelectedCards: boolean
    includeMentionedCards: boolean
    includeLorebooks: boolean
    includeRecentScenes: number
    includeAdventureTurns?: number
    includeCharacterChatTurns?: number
    tokenBudget: number
    styleSource?: 'current_scene' | 'whole_story' | 'card' | 'custom'
    customStyleInstruction?: string
}

export interface StoryContextTrace {
    cards: Array<{
        kind: StoryCardKind
        id: string
        title: string
        included: boolean
        reason: 'selected' | 'mentioned' | 'source' | 'lore_activation' | 'recent' | string
        estimatedTokens?: number
        skippedReason?: 'disabled' | 'budget' | 'duplicate' | 'missing_content' | string | null
    }>
    loreEntries: Array<{
        lorebookId: string
        entryId: string
        title: string
        included: boolean
        matchedKeys: string[]
        estimatedTokens?: number
        skippedReason?: string
    }>
    scenes: Array<{
        sceneId: string
        title: string
        included: boolean
        reason: 'current' | 'recent' | 'manual' | string
        estimatedTokens?: number
    }>
    totalEstimatedTokens: number
}

export type StoryGenerationCommand = 'continue' | 'rewrite' | 'expand' | 'condense' | 'describe' | 'critique' | 'custom'
export type StoryGenerationStatus = 'candidate' | 'accepted' | 'rejected' | 'stashed'

export interface StoryGeneration {
    id: string
    storyId?: string
    sceneId: string
    chapterId?: string
    command: StoryGenerationCommand
    inputRange?: { startOffset: number; endOffset: number; text?: string } | null
    promptSummary: string
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
    povCardId?: string | null
    locationCardId?: string | null
    activeCardRefs: StoryCardRef[]
    mentionRefs: StoryMentionRef[]
    generationHistory?: StoryGeneration[]
    createdAt?: string
    updatedAt?: string
}

export interface Story {
    id: string
    title: string
    description?: string | null
    source?: StorySource
    scenes: StoryChapter[]
    chapters?: StoryChapter[]
    activeCardRefs: StoryCardRef[]
    activeContext: StoryContextSettings
    metadata?: Record<string, unknown>
    createdAt?: string
    updatedAt?: string
}

export interface StoryCreateRequest {
    title: string
    description?: string | null
    source?: StorySource
    chapters?: Array<Partial<StoryChapter>>
    cardRefs?: Array<{
        kind: StoryCardKind
        cardId: string
        source?: StoryCardRefSource
        enabled?: boolean
        precedence?: number
        chapterId?: string | null
    }>
    activeContext?: StoryContextSettings
    metadata?: Record<string, unknown>
}

export interface StoryGenerateRequest {
    sceneId: string
    command: StoryGenerationCommand
    selection?: { startOffset: number; endOffset: number; text: string }
    instruction?: string
    contextSettings?: Partial<StoryContextSettings>
    requestId?: string
}

export interface StoryGenerateResponse {
    generation: StoryGeneration
    scene?: StoryChapter
    stagedCardUpdates?: unknown[]
}
