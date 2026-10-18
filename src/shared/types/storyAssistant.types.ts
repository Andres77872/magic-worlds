import type { StoryAnnotationAnchor,StoryAnnotationSelection } from './storyAnnotation.types'
import type { StoryCardKind,StoryNovelDetails,StoryInheritance,StoryStyleConvention,StoryStyleExample } from './story.types'
import type { StoryVariantReference,StoryVariantSnapshot } from './storyVariant.types'
import type { StoryFactKind } from './storyPlanning.types'

export interface StoryAssistantContextLimits {contextWindow:number;outputTokens:number;maxSources:number;maxPassages:number}
export type StoryAssistantLineEditFocus='grammar'|'clarity'|'repetition'|'rhythm'|'word_choice'
/** A named task the author chose. Writing actions use Suggest and return a proposal; the others use Ask and answer in prose. */
export type StoryAssistantAction=
    | {kind:'transform';pov:'first'|'second'|'third'|null;tense:'past'|'present'|null}
    | {kind:'line_edit';focus:StoryAssistantLineEditFocus[]}
    | {kind:'dialogue';speaker:string}
    | {kind:'bridge'}
    | {kind:'brainstorm';topic:'premise'|'conflict'|'stakes'|'names'|'what_if'}
    | {kind:'outline';target:'synopsis'|'beats'|'chapter_plan'}
    | {kind:'summary'}
export type StoryAssistantActionKind=StoryAssistantAction['kind']
export interface StoryAssistantContextRequest {
    sourceVersion:string;anchorSceneId:string;scope:'selection'|'scene'|'chapter'|'novel'|'scenes';sceneIds:string[]
    selection:StoryAnnotationSelection|null;task:'ask'|'suggest';message:string;revealPolicy:'through_anchor'|'author_analysis'
    includeArchived:boolean;includeCodex:boolean;limits:StoryAssistantContextLimits
    /** Absent unless the author chose one, so earlier requests keep their exact shape. */
    action?:StoryAssistantAction
}
export type StoryAssistantContextOptions=Omit<StoryAssistantContextRequest,'sourceVersion'>
export interface StoryAssistantPassage {id:string;startOffset:number;endOffset:number;quote:string;anchor:StoryAnnotationAnchor|null}
export interface StoryAssistantSource {
    sceneId:string;chapterId:string;partId:string|null;title:string;chapterTitle:string;revision:number;metadataRevision:number;contentHash:string
    chapterMetadataRevision:number;partMetadataRevision:number|null;readOnly:boolean;writing:Omit<StoryInheritance['values'],'includeInAI'|'includeInExport'>;complete:boolean;passages:StoryAssistantPassage[]
}
export interface StoryAssistantCard {
    referenceId:string;kind:StoryCardKind;cardId:string;title:string;text:string;snapshotHash:string;sourceVersionId:string|null;appliesTo:string[]
}
export interface StoryAssistantConflict {kind:StoryCardKind;cardId:string;referenceIds:string[]}
export type StoryAssistantSourceExclusion='trashed'|'merged'|'archived'|'excluded_from_ai'|'later_scene'|'source_limit'|'empty'|'passage_limit'|'budget'
export type StoryAssistantCardExclusion='settings'|'disabled'|'reveal_unverified'|'empty'|'budget'
/** An approved planning fact that holds at an included scene; the assistant reads it as the author's plan. */
export interface StoryAssistantPacketFact {
    id:string;revision:number;subject:string;kind:StoryFactKind;statement:string;object:string|null;fromSceneId:string|null;untilSceneId:string|null
}
export interface StoryAssistantPacket {
    schemaVersion:1;storyId:string;sourceVersion:string;task:StoryAssistantContextRequest['task'];message:string;scope:StoryAssistantContextRequest['scope']
    revealPolicy:StoryAssistantContextRequest['revealPolicy'];anchorSceneId:string;readOnly:boolean
    novel:{title:string;metadataRevision:number;structureRevision:number;contextRevision:number;writing:Pick<StoryNovelDetails,'language'|'genre'|'styleGuide'|'narrator'|'tense'>}
    sources:StoryAssistantSource[];cards:StoryAssistantCard[];conflicts:StoryAssistantConflict[];facts?:StoryAssistantPacketFact[];action?:StoryAssistantAction
    /** The sources' scene IDs in reading order (sources list the anchor first); absent only from older replies without an action. */
    readingOrder?:string[]
    /** The style sheet: conventions, examples, and the voices of the character cards in this packet. */
    style?:StoryAssistantStyle
    /** The author's saved reply preferences (A25); absent when none are saved. */
    preferences?:StoryAssistantPreferences
    /** Saved summaries of in-scope scenes outside the sources, in reading order, each written for the scene's saved revision (K09). */
    summaries?:StoryAssistantPacketSummary[]
    /** With the summary action: each read chapter with every scene its summary covers, and how many scenes the book's summary covers. */
    chapters?:StoryAssistantPacketChapter[];bookScenes?:number
    /** The saved book summary, for whole-novel author analysis while written for today's scenes. */
    bookSummary?:{text:string}
    /** Saved summaries of wholly in-scope chapters none of whose scenes are sources, in reading order (rest of K09). */
    chapterSummaries?:StoryAssistantPacketChapterSummary[]
    /** With the summary action in a novel with parts: each part with covered scenes and its chapters, in reading order. */
    parts?:StoryAssistantPacketPart[]
    /** Saved summaries of wholly in-scope parts none of whose scenes are sources, in reading order (rest of K09). */
    partSummaries?:StoryAssistantPacketPartSummary[]
}
export interface StoryAssistantPacketPart {partId:string;title:string;chapterIds:string[]}
export interface StoryAssistantPacketPartSummary {partId:string;title:string;text:string}
/** What a summary unit covers in one Summary request: how many scenes it has and which (`sceneId@revision`, reading order) the packet holds. */
export interface StoryAssistantCoverageUnit {scenes:number;covered:string[]}
export interface StoryAssistantSummaryCoverage {
    book:StoryAssistantCoverageUnit;chapters:Array<StoryAssistantCoverageUnit&{chapterId:string}>;parts?:Array<StoryAssistantCoverageUnit&{partId:string}>
}
export interface StoryAssistantPacketSummary {sceneId:string;title:string;revision:number;text:string}
export interface StoryAssistantPacketChapter {chapterId:string;title:string;sceneIds:string[]}
export interface StoryAssistantPacketChapterSummary {chapterId:string;title:string;text:string}
/** Why a saved scene summary stayed out: written for another revision, never tied to one, too long, over the count, no room, or its chapter's or part's summary is sent. */
export type StoryAssistantSummaryExclusion='stale'|'unverified'|'too_long'|'limit'|'budget'|'chapter'|'part'
/** Why a saved chapter or book summary stayed out: its scenes changed, it was never tied to them, too long, over the count, or no room. */
export type StoryAssistantWideSummaryExclusion='stale'|'unverified'|'too_long'|'limit'|'budget'
/** How the author likes the assistant to answer, for the whole account. It never sets manuscript style. */
export interface StoryAssistantPreferences {
    length:'brief'|'balanced'|'detailed';format:'any'|'prose'|'lists';tone:'neutral'|'direct'|'encouraging';replyLanguage:'question'|'novel';note:string
}
/** The saved preferences and their version; version 0 means none are saved. */
export interface StoryAssistantPreferencesState {schemaVersion:1;preferences:StoryAssistantPreferences|null;version:number}
/** One named value a preset asks for: free text up to a length, or one of a few options. */
export type StoryAssistantPresetInput =
    | {key:string;label:string;kind:'text';required:boolean;maxLength:number}
    | {key:string;label:string;kind:'choice';required:boolean;options:string[]}
/** An instruction with {{key}} inputs, the task and optional action it is written for, and defaults applied when it is used (A19). */
export interface StoryAssistantPresetDefinition {
    instruction:string;inputs:StoryAssistantPresetInput[];task:'ask'|'suggest';action:StoryAssistantAction|null
    scope:'selection'|'scene'|'chapter'|'novel'|null;revealPolicy:StoryAssistantContextRequest['revealPolicy']|null
    profile:import('./llm.types').LlmSelection|null
}
/** The account's preset at its current revision; every saved change takes the next revision. */
export interface StoryAssistantPreset {id:string;revision:number;name:string;definition:StoryAssistantPresetDefinition;trashedAt:string|null;createdAt:string;updatedAt:string}
export interface StoryAssistantPresetList {schemaVersion:1;presets:StoryAssistantPreset[];limit:number}
/** What a turn names: the preset version its message was filled from and the values. */
export interface NovelPresetReference {id:string;revision:number;inputs:Record<string,string>}
/** What a turn froze: that version's name and definition, so the reply keeps showing it after the preset changes. */
export interface NovelPresetSnapshot extends NovelPresetReference {name:string;definition:StoryAssistantPresetDefinition}
export interface StoryAssistantStyle {
    conventions:StoryStyleConvention[];examples:StoryStyleExample[]
    voices:Array<{referenceId:string;name:string;traits:string;lines:string[]}>
}
/** Read-only preparation. This result grants no manuscript-write or model-execution authority. */
export interface StoryAssistantContext {
    schemaVersion:1;projection:'assistant_context';storyId:string;sourceVersion:string;request:StoryAssistantContextRequest;packet:StoryAssistantPacket
    messages:[{role:'system';content:string},{role:'user';content:string}];packetHash:string
    trace:{estimator:'utf8-message-bytes-v1';inputEstimate:number;outputReserve:number;contextWindow:number;eligibleScenes:number;consideredScenes:number;includedScenes:number
        excluded:Array<{sceneId:string;reason:StoryAssistantSourceExclusion}>;cardExclusions:Array<{referenceId:string;sceneId:string;reason:StoryAssistantCardExclusion}>;conflicts:StoryAssistantConflict[]
        factExclusions?:Array<{factId:string;reason:'limit'|'budget'}>
        /** Without room, the examples are left out first and then the whole style part. */
        styleOmitted?:'examples'|'all'
        summaryExclusions?:Array<{sceneId:string;reason:StoryAssistantSummaryExclusion}>
        chapterSummaryExclusions?:Array<{chapterId:string;reason:StoryAssistantWideSummaryExclusion|'part'}>
        bookSummaryOmitted?:Exclude<StoryAssistantWideSummaryExclusion,'limit'>
        partSummaryExclusions?:Array<{partId:string;reason:StoryAssistantWideSummaryExclusion}>
        /** With the summary action (since part summaries): what each chapter, part and book summary from the reply covers. */
        summaryCoverage?:StoryAssistantSummaryCoverage}
}


/** A frozen suggestion: candidate status never grants manuscript-write authority. */
export interface NovelAssistantCandidate {
    id:string;schemaVersion:1;storyId:string;sourceVersion:string;sceneId:string;chapterId:string;baseRevision:number;baseContentHash:string
    operation:'replace_selection'|'replace_scene'|'append_scene';selection:StoryAnnotationSelection|null
    markdown:string;instruction:string;packetHash:string;status:'candidate'
}
export type NovelAssistantCitation=
    | {type:'passage';id:string;sceneId:string;revision:number;contentHash:string;startOffset:number;endOffset:number;quote:string;anchor:StoryAnnotationAnchor|null}
    | {type:'pin';referenceId:string;snapshotHash:string;title:string;text:string;sourceVersionId:string|null;appliesTo:string[]}
/** A story fact the reply proposes from one saved passage; the author approves it in Facts. */
export interface NovelAssistantFact {
    subject:string;kind:'knowledge'|'relationship'|'possession'|'location'|'state'|'trait'|'event';statement:string;object:string|null
    passage:string;sceneId:string;revision:number;excerpt:string|null
}
/** A possible inconsistency between saved passages; the author resolves it as a continuity task. */
export interface NovelAssistantIssue {
    title:string;detail:string;certainty:'certain'|'likely'|'possible'
    evidence:Array<{passage:string;sceneId:string;revision:number;excerpt:string|null}>
    /** Approved facts in the reply's packet that the prose contradicts. */
    facts?:string[]
}
export type NovelCritiqueAspect='pacing'|'causality'|'purpose'|'exposition'|'character'|'dialogue'|'clarity'
/** A developmental observation with cited passages and revision options; never a score. */
export interface NovelAssistantNote {
    aspect:NovelCritiqueAspect;title:string;observation:string
    evidence:Array<{passage:string;sceneId:string;revision:number;excerpt:string|null}>;options:string[]
}
/** Ordered one-scene steps; each runs as its own reviewed suggestion, so the plan applies nothing. */
export interface NovelAssistantPlan {title:string;steps:Array<{sceneId:string;revision:number;instruction:string}>}
/**
 * One proposed outline change at the scenes' saved revisions. The author applies each one, or several ready ones
 * together as one undoable change. Chapter changes name chapters of the reply's writable scenes; `partId` is the
 * part a moved or new chapter ends up in (null: the novel's top level).
 */
export type NovelAssistantStructureChange=
    | {kind:'move_scene';sceneId:string;revision:number;chapterId:string;beforeSceneId:string|null;reason:string}
    | {kind:'split_scene';sceneId:string;revision:number;offset:number;excerpt:string;title:string;reason:string}
    | {kind:'merge_scenes';sceneId:string;revision:number;otherSceneId:string;otherRevision:number;reason:string}
    | {kind:'split_chapter';chapterId:string;sceneId:string;revision:number;title:string;reason:string}
    | {kind:'merge_chapters';chapterId:string;otherChapterId:string;reason:string}
    | {kind:'move_chapter';chapterId:string;partId:string|null;beforeChapterId:string|null;reason:string}
    | {kind:'new_chapter';chapterId:string;partId:string|null;title:string;sceneIds:string[];reason:string}
    /** A new part starts at the chapter and takes the chapters after it in its part; `partId` is the part it was in when read. */
    | {kind:'new_part';chapterId:string;partId:string|null;title:string;reason:string}
/** A proposed summary of one source scene at the revision and content it read; the author may save it as the scene's summary. */
export interface NovelAssistantSceneSummary {sceneId:string;revision:number;contentHash:string;complete:boolean;text:string}
/** A proposed chapter, part or book summary and the `sceneId@revision` list it covered; complete only when it covered every scene it summarizes. */
export interface NovelAssistantChapterSummary {chapterId:string;basis:string[];complete:boolean;text:string}
export interface NovelAssistantPartSummary {partId:string;basis:string[];complete:boolean;text:string}
export interface NovelAssistantBookSummary {basis:string[];complete:boolean;text:string}
export interface NovelAssistantResult {
    schemaVersion:1;storyId:string;sourceVersion:string;packetHash:string;answer:string;citations:NovelAssistantCitation[];proposal:NovelAssistantCandidate|null
    facts?:NovelAssistantFact[];issues?:NovelAssistantIssue[];notes?:NovelAssistantNote[];plan?:NovelAssistantPlan;structure?:NovelAssistantStructureChange[]
    /** How many proposed outline changes were left out because they did not fit the reply's sources or their kind. */
    structureOmitted?:number
    summaries?:NovelAssistantSceneSummary[];chapterSummaries?:NovelAssistantChapterSummary[];partSummaries?:NovelAssistantPartSummary[];bookSummary?:NovelAssistantBookSummary
}
export interface NovelGenerationReference {generationId:string;parentHash:string}
export interface NovelRefinementReference extends NovelGenerationReference {variant?:StoryVariantReference}
export interface NovelRefinementParent {
    id:string;storyId:string;chapterId:string;sceneId:string;baseRevision:number
    command:'continue'|'rewrite'|'expand'|'condense'|'describe'|'custom'
    range:{startOffset:number;endOffset:number;textHash:string}|null
    output:string;instruction:string|null;parentGenerationId:string|null
}
export interface NovelRefinementContext {schemaVersion:1;parent:NovelRefinementParent;parentHash:string}
/** A selected authored source retains a finite original-model parent. */
export type NovelRefinementSource=NovelRefinementContext|(NovelRefinementContext&{variant:StoryVariantSnapshot})
export interface NovelAssistantRecord {context:StoryAssistantContext;result:NovelAssistantResult;refinement?:NovelRefinementSource;preset?:NovelPresetSnapshot}
export interface NovelAssistantTurnPreview {
    refinement?:NovelRefinementSource
    preset?:NovelPresetSnapshot
    schemaVersion:1;kind:'novel_turn_preview';conversationId:number;conversationVersion:number;storyId:string
    context:StoryAssistantContext;profile:Omit<import('./llmProfile.types').EffectiveLlmProfile,'project_hash'>&{provider_options:Record<string,unknown>};payload:{agt:Record<string,unknown>;messages:Array<{role:string;content:string}>}
    promptHash:string;inputEstimate:number;history:{included:number[];excluded:Array<{messageId:number;reason:'scope'|'source_changed'|'source_unavailable'|'budget'}>}
}
