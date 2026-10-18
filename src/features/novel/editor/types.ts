import type { TextGenerationOptions } from '@/shared/types/textGeneration.types'
/**
 * Shared editor-slice types: the inline-AI lifecycle, the codex entries fed
 * to @mention autocomplete, and the imperative handle the studio uses to
 * resolve suggestions before chapter switches.
 */

import type { SessionLoreEntry } from '@/features/lorebook/loreTriggers'
import type { StoryCardKind, StoryGeneration, StoryGenerationCommand, StoryManuscriptDocument,StorySelection } from '@/shared'
import type { ManuscriptPosition } from './manuscript'
import type { CodexDetectionName } from '../hooks/useCodex'
import type { StoryVariantSnapshot } from '@/shared/types/storyVariant.types'

/**
 * Inline AI lifecycle. Single source of truth lives in the extension storage.
 * There is no reveal phase: generated prose lands in one transaction and is
 * reviewed in place, so the machine is idle → prompting? → pending → reviewing.
 */
export type InlineAIPhase = 'idle' | 'prompting' | 'pending' | 'reviewing'

/** How much prose a beat should produce. Appended to the instruction; no API field. */
export type BeatLength = 'short' | 'medium' | 'long'


export interface EditorCodexEntry {
    id: string
    label: string
    kind: StoryCardKind
    enabled: boolean
    description?: string
    aliases?: string[]
    scope?: 'novel' | 'chapter' | 'scene'
    scopeLabel?: string
    sourceId?: string
    sourceVersionId?: string | null
    sourceVersionNumber?: number | null
    removed?: boolean
    contextState?: 'enabled' | 'disabled' | 'removed' | 'outside' | 'shadowed'
    contextRevision?: number
}

export interface InlineAIRequest {
    command: StoryGenerationCommand
    cursorOffset?: number
    instruction?: string
    /**
     * What the writer actually typed, before the length sentence was appended.
     * Kept separate from `instruction` so the prompt can be shown back to them
     * and stored with the generation — the text is not the whole record of a
     * beat; what was asked for is half of it.
     */
    prompt?: string
    selection?: { startOffset: number; endOffset: number; text: string }
}

export interface NovelEditorHandle {
    getMarkdown: () => string
    getDocument: () => StoryManuscriptDocument | null
    getSelection: () => StorySelection | null
    /** Opaque editor identity survives React handle refreshes, but not an editor remount. */
    getInstanceToken: () => object | null
    getSplitCursor: () => {nodeId:string;offset:number} | null
    getPosition: () => ManuscriptPosition | null
    focus: () => void
    /** Open the find & replace panel (the studio header's overflow menu). */
    openFind: () => void
    openLink:()=>void
    openReferences:()=>void
    openBlockMove:()=>void
    hasActiveSuggestion: () => boolean
    /** Resolve any live suggestion (accept keeps text, reject restores). Must be awaited before chapter switches. */
    resolveSuggestion: (mode: 'accept' | 'reject') => Promise<void>
    /** Stage a saved, source-checked candidate as decorations; acceptance remains explicit. */
    reviewGeneration: (review: SavedGenerationReview) => boolean
    prepareVariantDraft?: (context: import('../persistence/authorVariantJournal').AuthorVariantContext) => StoryManuscriptDocument | null
    /** Deletes the current selection only while its text equals `expected` (writable, no live suggestion). */
    cutSelection?: (expected: string) => boolean
    /** Inserts plain text (blank lines start paragraphs) at the cursor (writable, no live suggestion). */
    insertText?: (text: string) => boolean
}

export interface SavedGenerationReview {
    generation: StoryGeneration
    operation: 'replace_selection' | 'replace_scene' | 'append_scene'
    document: StoryManuscriptDocument
    /** Full reviewed scene snapshot; model output remains the original parent. */
    variant?: StoryVariantSnapshot
}

export interface NovelEditorProps {
    /** Device/offline writing keeps manual editing available while remote AI controls pause. */
    aiDisabled?: boolean
    showInvisibles?:boolean
    typingPreferences?:import('../utils/typingPreferences').TypingPreferences
    /** With completions on (A27), Mod-Shift-Enter continues from the cursor with this length sentence; absent while they are off (the key then opens the beat composer like Mod-Enter). */
    completionInstruction?:string|null
    manuscriptLanguage?:string|null
    searchTarget?:import('./extensions/manuscriptSearchTarget').ManuscriptSearchTarget|null
    searchTargetBlocked?:boolean
    onSearchReveal?:(token:string,applied:boolean)=>void
    initialDocument?: StoryManuscriptDocument
    /** Explicit Markdown input for isolated previews/imports; never a body writer. */
    initialBody?: string
    initialPosition?: ManuscriptPosition | null
    /** Read at editor creation so a recovery remount uses the latest view point. */
    getInitialPosition?: () => ManuscriptPosition | null
    /** Remember the actual scene when the reader or writer focuses its text. */
    onActivate?: () => void
    codexEntries: EditorCodexEntry[]
    /** Every readable stored pin, including removed/out-of-scope identities. */
    referenceEntries?: EditorCodexEntry[]
    onSetReferenceContext?: (entry: EditorCodexEntry, enabled: boolean) => Promise<void>
    /** Effective codex names/aliases, including context-excluded sources (ember). */
    detectionNames?: CodexDetectionName[]
    /** Cloned lorebook entries as session lore, for inline trigger detection (arcane). */
    loreEntries?: SessionLoreEntry[]
    /** Open the exact stored snapshot preview by identity. */
    onOpenCodexEntry?: (codexEntryId: string) => void
    /** Offer to add the current selection to the codex (selection toolbar). */
    onAddToCodex?: (selectedText: string) => void
    /** Hides the editor chrome / widens vertical breathing when focus mode is on. */
    focusMode?: boolean
    /** Keep the caret line vertically centered (typewriter scrolling). */
    typewriter?: boolean
    /** Canonical JSON after user edits; preview decorations never enter it. */
    onDocumentChange: (document: StoryManuscriptDocument,anchorEdits?:import('@/shared').StoryAnchorEdit[]|null) => void
    onPositionChange?: (position: ManuscriptPosition) => void
    /**
     * Persist the current body immediately; awaited before generating and after
     * accepting. Resolves false when the body could not be saved — generation
     * is aborted in that case so the model never works from a stale manuscript.
     */
    onRequestSaveFlush: () => Promise<boolean>
    onGenerate: (request: InlineAIRequest, options?: TextGenerationOptions) => Promise<StoryGeneration>
    onAcceptGeneration: (generationId: string, variant?: StoryVariantSnapshot) => Promise<void>
    onDiscardGeneration: (generationId: string) => Promise<void>
    /** Critique output is feedback, not prose — the studio shows it outside the manuscript. */
    onCritiquePreview?: (text: string, state: 'generating' | 'saving' | 'interrupted' | 'failed') => void
    onCritiqueResult: (generation: StoryGeneration) => void
    onSuggestionPhaseChange?: (phase: InlineAIPhase) => void
    /** Codex entries currently enabled — shown as the beat composer's context readout. */
    enabledContextCount?: number
    /**
     * The story's workspace is archived: the manuscript can be read, selected,
     * copied and searched, but nothing in it can be edited or generated.
     */
    readOnly?: boolean
}
