import type { RootOrganization } from './workspace.types'
import type { StoryWritingTemplate } from './storyTemplate.types'
import type { StoryCreationSourcesSelection } from './storyCreationSources.types'
import type { StoryOutlineOperation } from './storyOutline.types'
export type StorySourceKind =
    | 'blank'
    | 'character'
    | 'world'
    | 'item'
    | 'adventure_template'
    | 'adventure_session'

/** Stored source returned on a hydrated story. */
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
    /** Adventure templates and lorebook entries keep no saved versions: the library details this copy was taken from or last reviewed against. */
    source_base?: StorySnapshotSourceBase | null
    story_card_kind: StoryCardKind
}

/** One state of an unversioned library source's details, and its id. */
export interface StorySnapshotSourceBase {
    state_id: string
    name?: string | null
    alias?: string | null
    description?: string | null
    race?: string | null
    type?: string | null
    category?: StorySnapshotCategory[] | null
}

export interface StoryCardRef {
    id: string
    storyId: string
    chapterId: string | null
    sceneId: string | null
    removedAt: string | null
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
    styleSource: 'current_scene' | 'whole_story' | 'card' | 'custom' | null
    customStyleInstruction: string | null
}
export type StoryCodexReferenceInput=Pick<StoryCardRef,'kind'|'cardId'>&Partial<Pick<StoryCardRef,'source'|'enabled'|'precedence'|'chapterId'|'sceneId'|'snapshot'>>
export type StoryCodexPatch=Partial<Pick<StoryCardRef,'source'|'enabled'|'precedence'|'chapterId'|'sceneId'|'snapshot'>>
export type StoryCodexOperation=
    |{op:'add';refs:StoryCodexReferenceInput[]}
    |{op:'update';id:string;patch:StoryCodexPatch}
    |{op:'remove'|'restore';id:string}
    /** Take the chosen fields from the reviewed library version; fields left out keep the novel's values. */
    |{op:'refresh';id:string;sourceVersionId:string;take:StoryCodexLibraryField[]}
    /** Create a private library card, or an entry in a library lorebook, from a reviewed discovery, and copy it here (K12). */
    |{op:'discover';destination:StoryCodexDiscoveryDestination;lorebookId?:string;fields:StoryCodexDiscoveryFields}
/** Where a reviewed novel discovery can be created in the library. */
export type StoryCodexDiscoveryDestination='character'|'world'|'item'|'lorebook_entry'
/** A discovery's details: race only for a character, type only for a setting or item, keys only (and always) for a lorebook entry. */
export interface StoryCodexDiscoveryFields {name:string;alias?:string;race?:string;type?:string;description:string;keys?:string[]}
export interface StoryCodexWrite {requestId:string;expectedContextRevision:number;operation:StoryCodexOperation}
/** The card details a Codex copy can take from its library card. */
export type StoryCodexLibraryField='name'|'alias'|'description'|'race'|'type'|'category'
/** A library card whose current version is newer than the one its Codex copy names. */
export interface StoryCodexLibraryVersion {refId:string;latestVersionNumber:number}
/** An adventure template or lorebook entry whose library details changed since its Codex copy was taken or last reviewed. */
export interface StoryCodexLibraryChange {refId:string;sourceVersionId:string}
export interface StoryCodexLibraryNotices {versions:StoryCodexLibraryVersion[];changed:StoryCodexLibraryChange[]}
/**
 * The library card's current version in snapshot form (its pins name that version) and the details of the version
 * the novel copied, when that version is still stored.
 */
export interface StoryCodexLibraryReview {refId:string;current:StoryCardSnapshot;base:Partial<Pick<StoryCardSnapshot,StoryCodexLibraryField>>|null
    /** What applying records: the card's version, or the library state of a template or entry. */
    sourceVersionId:string}
/**
 * What staging a reviewed description into a Codex entry's library card starts from: the card's private draft, else
 * its published body. `stamp` names that exact content; a stage from an older stamp is refused.
 */
export interface StoryCodexLibraryDraft {refId:string;basis:'draft'|'published';name:string;alias:string|null;description:string
    /** A character's race, or a setting's or item's type: the one detail besides name, alias and description each kind has. */
    race?:string|null;type?:string|null;stamp:string;versionNumber:number}
/** The reviewed details to stage; those left out keep the draft's values, and an empty alias clears it. */
export type StoryCodexLibraryDraftFields=Partial<Record<'name'|'alias'|'description'|'race'|'type',string>>
/**
 * The library lorebook entry a Codex copy came from, as stored. Entries have no draft: a write changes the library entry
 * itself. `stamp` names the whole stored entry; a write from an older stamp is refused.
 */
export interface StoryCodexLibraryEntry {refId:string;lorebookId:string;entryId:string;title:string;keys:string[];content:string;stamp:string}
/** The reviewed title, keys and content to write; those left out stay as stored. */
export interface StoryCodexLibraryEntryFields {title?:string;keys?:string[];content?:string}
export interface StoryCodexAcknowledgement {contextRevision:number;refs:StoryCardRef[]}

export interface StoryCopyOptions {
    includeNotes:boolean
    includeContext:boolean
    includeArchived:boolean
    includeTrash:boolean
}
export interface StoryCommentCopyChoice {includeComments?:boolean;includeBookmarks?:boolean;sourceAnnotationRevision?:number}
export interface StoryCopyWrite extends StoryCommentCopyChoice {requestId:string;expectedSourceVersion:string;title:string;options:StoryCopyOptions}
export interface StoryCopyCounts {parts:number;chapters:number;scenes:number;references:number}
export interface StoryCopyPreview {
    sourceId:string
    sourceTitle:string
    sourceVersion:string
    annotationRevision?:number
    variants:Array<Pick<StoryCopyOptions,'includeArchived'|'includeTrash'|'includeContext'>&{counts:StoryCopyCounts;comments?:number;bookmarks?:number}>
}
export interface StoryCopyAcknowledgement extends StoryCommentCopyChoice {
    kind:'novel_copy'
    requestId:string
    storyId:string
    sourceId:string
    sourceVersion:string
    title:string
    options:StoryCopyOptions
}
export interface StoryCopyProvenance {
    schemaVersion:1
    sourceId:string
    sourceTitle:string
    sourceVersion:string
    createdAt:string
    options:StoryCopyOptions
    counts:StoryCopyCounts
    annotations?:{sourceRevision:number;included:boolean;bookmarksIncluded?:boolean;comments?:number;bookmarks?:number;count:number;identityMap:Record<string,string>}
    sourceRevisions:{
        metadataRevision:number;structureRevision:number;contextRevision:number
        parts:Array<{id:string;metadataRevision:number}>
        chapters:Array<{id:string;partId:string|null;metadataRevision:number}>
        scenes:Array<{id:string;chapterId:string;title:string;revision:number;metadataRevision:number;contentHash:string}>
    }
    identityMap:{novel:Record<string,string>;parts:Record<string,string>;chapters:Record<string,string>;scenes:Record<string,string>;references:Record<string,string>;blocks:Record<string,Record<string,string>>}
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

export interface StoryContextSceneTrace {
    sceneId: string
    chapterId: string
    revision: number
    metadataRevision: number
    title: string
    included: true
    reason: 'current' | 'recent' | 'retrieved'
    estimatedTokens: number
}

export interface StoryContextTrace {
    cards: StoryContextCardTrace[]
    loreEntries: StoryContextLoreTrace[]
    scenes: StoryContextSceneTrace[]
    structureRevision: number
    novelMetadataRevision: number
    contextRevision: number
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
    baseRevision?: number
    appliedRevision?: number | null
    instruction?: string | null
    requestId?: string | null
    id: string
    storyId: string
    chapterId: string
    sceneId: string
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

/** Supported canonical JSON; the API validates schemaVersion and node shapes. */
export interface StoryDocumentNode {
    type?: string
    attrs?: Record<string, unknown>
    content?: StoryDocumentNode[]
    text?: string
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}
export interface StoryManuscriptDocument {
    schemaVersion: 1
    content: StoryDocumentNode
}
export interface StoryUnitDetails {
    synopsis?: string | null
    summary?: string | null
    summaryRevision?: number | null
    /** Chapters: the `sceneId@revision` list the summary was written for (storySummaryBasis). */
    summaryBasis?: string[] | null
    narrator?: string | null
    tense?: string | null
    narrativeTime?: string | null
    /** Story chronology position; lower happens earlier, null is unknown. */
    storyTimeOrder?: number | null
    castIds?: string[] | null
    plotThreads?: string[] | null
    tags?: string[] | null
    plannedBeats?: string[] | null
    notes?: string | null
    includeInAI?: boolean | null
    includeInExport?: boolean | null
    /** Chapters only: front or back matter in exported books; absent or null is the main text. */
    exportRole?: StoryExportRole | null
}
export type StoryExportRole = 'copyright' | 'dedication' | 'epigraph' | 'foreword' | 'preface' | 'introduction'
    | 'afterword' | 'acknowledgments' | 'appendix' | 'glossary' | 'about_author'
export interface StoryInheritance {
    values: { status?: StoryChapterStatus; povCardId?: string; locationCardId?: string; narrator?: string; tense?: string; includeInAI: boolean; includeInExport: boolean }
    origins: Record<string, 'novel' | 'part' | 'chapter' | 'scene'>
    readOnly: boolean
}
export interface StoryUnitMetadata {
    id: string
    storyId: string
    title: string
    metadataRevision: number
    order: number
    /** Null inherits the parent's workflow status. */
    status: StoryChapterStatus | null
    wordGoal: number | null
    povCardId: string | null
    locationCardId: string | null
    details: StoryUnitDetails
    trashedAt: string | null
    copiedFrom: string | null
    previousStatus?: StoryChapterStatus | null
    mergedInto?: string | null
    inheritance?: StoryInheritance
    createdAt?: string
    updatedAt?: string
}
export type StoryPart = StoryUnitMetadata
export interface StoryScene extends StoryUnitMetadata {
    statistics?:import('./storyStudio.types').StorySceneStatistics|null
    chapterId: string
    document: StoryManuscriptDocument
    revision: number
    contentHash: string
    /** Read-only projections; scene writes accept document, never body. */
    body: string
    plainText: string
    copiedFromRevision?: number | null
    activeCardRefs: StoryCardRef[]
    generationHistory: StoryGeneration[]
}
export interface StoryChapter extends StoryUnitMetadata {
    partId: string | null
    scenes: StoryScene[]
    /** Read-only aggregate for manuscript statistics. */
    body: string
    activeCardRefs: StoryCardRef[]
    generationHistory: StoryGeneration[]
}
export interface StoryNovelDetails {
    povCardId?: string | null
    coverAssetId?: string | null
    coverAlt?: string | null
    language?: string | null
    genre?: string | null
    audience?: string | null
    synopsis?: string | null
    /** The book summary and the `sceneId@revision` list it was written for (storySummaryBasis). */
    summary?: string | null
    summaryBasis?: string[] | null
    styleGuide?: string | null
    narrator?: string | null
    tense?: string | null
    notes?: string | null
    tags?: string[]
    /** A calendar date (YYYY-MM-DD) in the author's own time zone. */
    deadline?: string | null
    /** Words a day, for the writing progress view. */
    dailyWordGoal?: number | null
    /** Conventions, preferred examples and character voices; null when cleared. */
    styleSheet?: StoryStyleSheet | null
}
export type StoryStyleConventionKind = 'spelling' | 'name' | 'capitalization' | 'hyphenation' | 'numbers' | 'punctuation' | 'usage' | 'other'
/** A copy editor's rule: a term and how to write it. */
export interface StoryStyleConvention { term: string; rule: string; kind: StoryStyleConventionKind }
/** A short passage in the voice the author wants; style, never story facts. */
export interface StoryStyleExample { label: string; text: string }
/** One Codex character's dialogue traits and up to three sample lines, keyed by the novel's Codex reference. */
export interface StoryVoiceSheet { refId: string; traits: string; lines: string[] }
export interface StoryStyleSheet { conventions: StoryStyleConvention[]; examples: StoryStyleExample[]; voices: StoryVoiceSheet[] }
export interface StorySectionStatistics {
    wordCount:number|null
    characterCount:number
    textBytes:number
    parts:number
    chapters:number
    scenes:number
}
export interface StoryStatistics {
    schemaVersion:1
    algorithm:'icu-word-en-v1'
    complete:true
    sourceStructureRevision:number
    active:StorySectionStatistics
    archived:StorySectionStatistics
    trashed:StorySectionStatistics
}
export interface Story {
    id: string
    title: string
    description: string | null
    source: StorySource
    metadataRevision: number
    structureRevision: number
    contextRevision: number
    status: StoryChapterStatus
    wordGoal: number | null
    details: StoryNovelDetails
    trashedAt: string | null
    copiedFrom: string | null
    parts: StoryPart[]
    chapters: StoryChapter[]
    chapterCount?: number|null
    sceneCount?: number|null
    /** Saved canonical text and hierarchy; independent of local unsaved prose. */
    statistics?:StoryStatistics|null
    /** Metadata-only list entry. Open it to load its scene documents. */
    summary?: true
    activeCardRefs: StoryCardRef[]
    activeContext: StoryContextSettings
    organization?: RootOrganization
    createdAt?: string
    updatedAt?: string
}
/** Initial grouping metadata. Every new chapter starts with one blank scene. */
export interface StoryChapterCreateRequest {
    title: string
    status?: StoryChapterStatus | null
    wordGoal?: number | null
    povCardId?: string | null
    locationCardId?: string | null
}

interface StoryCreateBase extends StoryCreationSourcesSelection {
    title: string
    description?: string | null
    expectedSourceVersion?:string
    activeContext?: StoryContextSettings
}
/** Send one complete initial outline. Template inputs retain their exact edited contents. */
export type StoryCreateRequest = StoryCreateBase & (
    | {chapters:StoryChapterCreateRequest[];template?:never}
    | {chapters?:never;template:StoryWritingTemplate}
)
export type StoryCreateWrite = StoryCreateRequest & {requestId:string}
/** The original bounded creation metadata, without manuscript prose. */
export interface StoryCreationAcknowledgement {
    kind: 'novel_create'
    requestId: string
    storyId: string
    write: StoryCreateWrite
}

export interface StoryGenerateRequest {
    baseRevision: number
    sceneId: string
    cursorOffset?: number
    command: StoryGenerationCommand
    selection?: StorySelection
    instruction?: string
    contextSettings?: StoryContextSettings
    llm?: import('./llm.types').LlmRequest
}
export interface StoryGenerateResponse {
    generation: StoryGeneration
    scene: StoryScene
    stagedCardUpdates: unknown[]
    llm_execution: import('./llm.types').LlmExecutionProvenance
}
export interface StoryMetadataPatch {
    title?: string
    status?: Exclude<StoryChapterStatus, 'archived'> | null
    wordGoal?: number | null
    povCardId?: string | null
    locationCardId?: string | null
    details?: StoryUnitDetails
}
export interface StoryNovelWrite {
    requestId: string
    expectedMetadataRevision: number
    title?: string
    description?: string | null
    status?: Exclude<StoryChapterStatus,'archived'>
    wordGoal?: number | null
    details?: StoryNovelDetails
    activeContext?: StoryContextSettings
}
export type StoryUnitWrite = StoryChapterWrite | StoryNovelWrite
export interface StoryChapterWrite extends StoryMetadataPatch {
    requestId: string
    expectedMetadataRevision: number
}
export interface StorySceneWrite extends StoryMetadataPatch {
    requestId: string
    expectedRevision?: number
    expectedMetadataRevision?: number
    document?: StoryManuscriptDocument
    anchorEdits?: import('./storyAnnotation.types').StoryAnchorEdit[]
}
export interface StoryGenerationCommit {
    requestId: string
    sceneId: string
    expectedRevision: number
    document: StoryManuscriptDocument
    anchorEdits?: import('./storyAnnotation.types').StoryAnchorEdit[]
    variant?: import('./storyVariant.types').StoryVariantReference
}
/** One reviewed suggestion in a changeset: the scene's saved document with the suggestion applied (R14). */
export interface StoryGenerationChangesetItem {
    generationId: string
    sceneId: string
    expectedRevision: number
    document: StoryManuscriptDocument
    anchorEdits?: import('./storyAnnotation.types').StoryAnchorEdit[]
}
/** 2–12 suggestions in distinct scenes, accepted in one transaction: every scene is written or none is. */
export interface StoryGenerationChangesetWrite { requestId: string; items: StoryGenerationChangesetItem[] }
export type StoryGenerationChangesetScene = StoryScene & { generationId: string; baseRevision: number }
export interface StoryGenerationChangeset { kind: 'generation_changeset'; storyId: string; requestId: string; scenes: StoryGenerationChangesetScene[] }
/** Why an undo left a scene as it is: written since the changeset, a suggestion waits there, or it cannot be written. */
export type StoryGenerationChangesetKeptReason = 'edited' | 'pendingSuggestion' | 'unavailable'
export interface StoryGenerationChangesetUndo {
    kind: 'generation_changeset_undo'; storyId: string; changesetId: string
    scenes: StoryScene[]; kept: { sceneId: string; reason: StoryGenerationChangesetKeptReason }[]
}
export type StoryRevisionSource='initial'|'manual'|'ai'|'restore'|'split'|'merge'|'branch'|'structure'
export interface StoryDocumentRevisionSummary {
    revision: number
    parentRevision: number | null
    contentHash: string
    source: StoryRevisionSource
    actor:'author'|'system'
    schemaVersion:number|null
    generationId: string | null
    variantId?: string
    restoredFrom: number | null
    createdAt: string
}
export interface StoryDocumentRevision extends StoryDocumentRevisionSummary {
    storyId:string;sceneId:string;document:StoryManuscriptDocument;body:string;plainText:string
}
export interface StorySceneRevisionHead {sceneId:string;chapterId:string;title:string;revision:number;metadataRevision:number;contentHash:string;readOnly:boolean}
export interface StorySceneRevisionQuery {before?:number;source?:StoryRevisionSource;actor?:'author'|'system';fromDate?:string;throughDate?:string}
export interface StorySceneRevisionPage {storyId:string;sceneId:string;head:StorySceneRevisionHead;items:StoryDocumentRevisionSummary[];nextBefore:number|null}
export interface StorySceneRestoreWrite {requestId:string;expectedRevision:number;expectedContentHash:string;sourceContentHash:string}
export interface StorySceneRestoreAcknowledgement {kind:'scene_restore';storyId:string;sceneId:string;sourceRevision:number;write:StorySceneRestoreWrite;revision:number;contentHash:string}
export type StoryStructureKind = 'part' | 'chapter' | 'scene'
export type StoryStructureHistoryOperation = {op:'undo_structure'|'redo_structure';revision:number;sourceStructureRevision:number}
export interface StorySnapshotCreateOperation {
    op:'create_snapshot'
    title:string
    note:string|null
    expectedSourceVersion:string
    sourceStructureRevision:number
    sourceAnnotationRevision?:number
}
export type StorySnapshotScene=Omit<StoryScene,'document'|'body'|'plainText'|'activeCardRefs'|'generationHistory'|'inheritance'>
export type StorySnapshotChapter=Omit<StoryChapter,'body'|'activeCardRefs'|'generationHistory'|'inheritance'|'scenes'>&{scenes:StorySnapshotScene[]}
export type StorySnapshotNovel=Pick<Story,'id'|'title'|'description'|'source'|'metadataRevision'|'structureRevision'|'contextRevision'|'status'|'wordGoal'|'details'|'trashedAt'|'copiedFrom'|'activeContext'>
export interface StorySnapshotManifest {
    schemaVersion:1
    storyId:string
    sourceVersion:string
    novel:StorySnapshotNovel
    parts:StoryUnitMetadata[]
    chapters:StorySnapshotChapter[]
    references:StoryCardRef[]
    annotations?:import('./storyAnnotation.types').StorySnapshotAnnotationCollection
}
export interface StorySnapshotSummary {
    id:number
    storyId:string
    name:string
    note:string|null
    sourceVersion:string
    manifestHash:string
    counts:StoryCopyCounts
    createdAt:string
}
export interface StorySnapshotDetail extends StorySnapshotSummary {manifest:StorySnapshotManifest}
export interface StorySnapshotComparison extends StorySnapshotDetail {current:StorySnapshotManifest}
export interface StorySnapshotPage {storyId:string;items:StorySnapshotSummary[];nextBefore:number|null}
export interface StorySnapshotPreview {storyId:string;title:string;sourceVersion:string;structureRevision:number;counts:StoryCopyCounts;annotations?:{revision:number;count:number}}
export interface StorySnapshotSceneView {storyId:string;snapshotId:number;manifestHash:string;scene:StoryScene}
export interface StorySnapshotRestoreOptions {text:boolean;details:boolean;organization:boolean;context:boolean;laterUnits:'keep'|'trash'}
export interface StorySnapshotRestoreOperation {
    op:'restore_snapshot'
    snapshotId:number
    manifestHash:string
    expectedSourceVersion:string
    sourceStructureRevision:number
    options:StorySnapshotRestoreOptions
}
export interface StorySnapshotRestoreChange {kind:'novel'|'part'|'chapter'|'scene'|'reference';id:string;title:string;fields:string[]}
export interface StorySnapshotRestorePreview {
    storyId:string;snapshotId:number;name:string;manifestHash:string;sourceVersion:string;structureRevision:number
    options:StorySnapshotRestoreOptions;current:StorySnapshotManifest;target:StorySnapshotManifest
    changes:StorySnapshotRestoreChange[];counts:StoryCopyCounts
    laterUnits:Array<{id:string;kind:'part'|'chapter'|'scene';title:string}>
    blockers:Array<{code:string;ids:string[]}>;canRestore:boolean
}
export interface StoryUnitCopyOperation extends StoryCommentCopyChoice {
    op:'duplicate'
    kind:'chapter'|'scene'
    id:string
    title?:string
    options:StoryCopyOptions
    expectedMetadataRevision:number
    expectedContextRevision:number
    sourceStructureRevision:number
    sourceScenes:Array<{id:string;revision:number;metadataRevision:number}>
}
/** One action over several active scenes: one structure revision, undone in one step. */
export type StoryBulkScenesOperation =
    | { op: 'bulk_scenes'; action: 'status'; ids: string[]; status: 'draft' | 'revising' | 'complete' }
    | { op: 'bulk_scenes'; action: 'move'; ids: string[]; parentId: string }
    | { op: 'bulk_scenes'; action: 'archive' | 'trash'; ids: string[] }
/** A unit an earlier step of the same changeset created, by that step's index. */
export interface StoryChangesetReference { created: number }
type StoryChangesetUnit = string | StoryChangesetReference
/** One step of a changeset; it may name a part or chapter an earlier step created. A bulk step only moves scenes. */
export type StoryChangesetStep =
    | { op: 'create'; kind: 'part' | 'chapter'; parentId?: StoryChangesetUnit | null; title: string; beforeId?: StoryChangesetUnit; afterId?: StoryChangesetUnit }
    | { op: 'move'; kind: StoryStructureKind; id: StoryChangesetUnit; parentId?: StoryChangesetUnit | null; beforeId?: StoryChangesetUnit }
    | { op: 'bulk_scenes'; action: 'move'; ids: string[]; parentId: StoryChangesetUnit }
    | { op: 'split_scene'; id: string; textOffset: number; expectedRevision: number; title: string }
    | { op: 'merge_scenes'; id: string; withId: string; expectedRevision: number; otherExpectedRevision: number; sceneBreak: boolean }
    | { op: 'split_chapter'; id: StoryChangesetUnit; beforeSceneId: string; title: string }
    | { op: 'merge_chapters'; id: StoryChangesetUnit; withId: StoryChangesetUnit }
    /** A new part takes this chapter and the ones after it in its part and follows that part (outside any part: the
     *  later chapters outside any part, before the parts), so the reading order stays the same. Changeset only. */
    | { op: 'start_part'; id: StoryChangesetUnit; title: string }
/** Up to 12 reviewed outline steps applied in order as one organization revision, so one undo reverses them all. */
export interface StoryChangesetOperation { op: 'changeset'; operations: StoryChangesetStep[] }
export type StoryStructureOperation =
    | { op: 'create'; kind: StoryStructureKind; parentId?: string | null; title: string; beforeId?: string; afterId?:string; document?: StoryManuscriptDocument }
    | { op: 'move'; kind: StoryStructureKind; id: string; parentId?: string | null; beforeId?: string }
    | { op: 'reorder'; kind: StoryStructureKind; parentId?: string | null; ids: string[] }
    | StoryUnitCopyOperation
    | { op: 'split_scene'; id: string; nodeId: string; offset: number; expectedRevision: number; title: string }
    /** Split so the new scene starts with the paragraph that begins at this offset of the scene's saved plain text. */
    | { op: 'split_scene'; id: string; textOffset: number; expectedRevision: number; title: string }
    | { op: 'merge_scenes'; id: string; withId: string; expectedRevision: number; otherExpectedRevision: number; sceneBreak: boolean }
    | { op: 'split_chapter'; id: string; beforeSceneId: string; title: string }
    | { op: 'merge_chapters'; id: string; withId: string }
    | { op: 'archive' | 'trash' | 'restore'; kind: StoryStructureKind; id: string; parentId?: string | null }
    | StoryBulkScenesOperation
    | StoryChangesetOperation
    | StoryOutlineOperation
    | StoryStructureHistoryOperation
    | StorySnapshotCreateOperation
    | StorySnapshotRestoreOperation
export interface StoryStructureWrite {
    requestId: string
    expectedStructureRevision: number
    operation: StoryStructureOperation
}
export interface StoryStructureAcknowledgement {
    structureRevision: number
    selectedId: string | null
    copy?:{requestId:string;storyId:string;operation:StoryUnitCopyOperation}
    history?:{requestId:string;storyId:string;operation:StoryStructureHistoryOperation;operationRevision:number}
    snapshot?:{requestId:string;storyId:string;operation:StorySnapshotCreateOperation;id:number;manifestHash:string;sourceVersion:string;counts:StoryCopyCounts}
    restore?:{requestId:string;storyId:string;operation:StorySnapshotRestoreOperation;snapshotId:number;manifestHash:string;sourceVersion:string;counts:StoryCopyCounts}
}
export interface StoryStructureRevision {
    storyId:string
    revision: number
    parentRevision: number | null
    action:string
    targetAction:string
    operationRevision:number
    kind:StoryStructureKind|null
    title:string|null
    actor:'author'|'system'
    reversible:boolean
    operation: Record<string, unknown>
    before:StoryStructureSnapshot|null
    after:StoryStructureSnapshot
    createdAt: string
    referenceChanges?:Array<{id:string;before:StoryStructureReferenceState|null;after:StoryStructureReferenceState}>
}
export interface StoryStructureReferenceState {enabled:boolean;removedAt:string|null;reference?:StoryCardRef}
export interface StoryStructureOutlineUnit {
    id:string
    title?:string
    wordGoal?:number|null
    details?:StoryUnitDetails
    order:number
    status:StoryChapterStatus|null
    trashedAt:string|null
    metadataRevision:number
    metadataHash?:string
    revision?:number
    logicalRevision?:number
    contentHash?:string
    partId?:string|null
    chapterId?:string
    previousStatus?:StoryChapterStatus|null
    mergedInto?:string|null
    povCardId:string|null
    locationCardId:string|null
    inheritedDetails:Pick<StoryUnitDetails,'narrator'|'tense'|'includeInAI'|'includeInExport'>
    scenes?:StoryStructureOutlineUnit[]
}
export interface StoryStructureSnapshot {
    structureRevision:number
    parts:StoryStructureOutlineUnit[]
    chapters:StoryStructureOutlineUnit[]
    novel?:Pick<StorySnapshotNovel,'id'|'title'|'description'|'wordGoal'|'details'|'status'|'trashedAt'|'activeContext'>
}
export type StoryStructureHistoryItem=Omit<StoryStructureRevision,'storyId'|'operation'|'before'|'after'>
export interface StoryStructureHistoryAction {revision:number;operationRevision:number;action:string}
export interface StoryStructureHistoryPage {
    storyId:string
    structureRevision:number
    undo:StoryStructureHistoryAction|null
    redo:StoryStructureHistoryAction|null
    items:StoryStructureHistoryItem[]
    nextBefore:number|null
}
export interface StoryStructureHistoryQuery {before?:number;action?:string;fromDate?:string;throughDate?:string}
/** Deliberate root-novel erasure; Trash remains independently recoverable. */
export interface StoryEraseWrite {
    requestId:string
    expectedSourceVersion:string
    confirmedTitle:string
}
export interface StoryErasePreview {
    schema:1
    kind:'novel_erase_preview'
    storyId:string
    title:string
    sourceVersion:string
    trashedAt:string
    policy:'explicit-novel-erase-v1'
    activeExecutions:number
    counts:Record<'parts'|'chapters'|'scenes'|'sceneRevisions'|'structureRevisions'|'cardRefs'|'generations'|'notes'|'bookmarks'|'annotationEvents'|'requestReceipts'|'executions'|'conversations'|'assistantMessages'|'variants',number>
}
export interface StoryEraseAcknowledgement {
    schema:1
    kind:'novel_erase'
    storyId:string
    requestId:string
    sourceVersion:string
    intentHash:string
    erasedAt:string
}
