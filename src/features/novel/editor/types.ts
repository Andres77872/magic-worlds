/**
 * Shared editor-slice types: the inline-AI lifecycle, the codex entries fed
 * to @mention autocomplete, and the imperative handle the studio uses to
 * resolve suggestions before chapter switches.
 */

import type { StoryCardKind, StoryGeneration, StoryGenerationCommand } from '@/shared'

/** Inline AI lifecycle. Single source of truth lives in the extension storage. */
export type InlineAIPhase = 'idle' | 'prompting' | 'pending' | 'revealing' | 'reviewing'

export interface EditorCodexEntry {
    id: string
    label: string
    kind: StoryCardKind
    enabled: boolean
}

export interface InlineAIRequest {
    command: StoryGenerationCommand
    instruction?: string
    selection?: { startOffset: number; endOffset: number; text: string }
}

export interface NovelEditorHandle {
    getMarkdown: () => string
    focus: () => void
    hasActiveSuggestion: () => boolean
    /** Resolve any live suggestion (accept keeps text, reject restores). Must be awaited before chapter switches. */
    resolveSuggestion: (mode: 'accept' | 'reject') => Promise<void>
}

export interface NovelEditorProps {
    chapterId: string
    initialBody: string
    codexEntries: EditorCodexEntry[]
    /** Markdown after each user edit. Never fired while a suggestion is alive. */
    onBodyChange: (markdown: string) => void
    /** Persist the current body immediately; awaited before generating and after accepting. */
    onRequestSaveFlush: () => Promise<void>
    onGenerate: (request: InlineAIRequest) => Promise<StoryGeneration>
    onAcceptGeneration: (generationId: string) => Promise<void>
    onDiscardGeneration: (generationId: string) => Promise<void>
    /** Critique output is feedback, not prose — the studio shows it outside the manuscript. */
    onCritiqueResult: (generation: StoryGeneration) => void
    onSuggestionPhaseChange?: (phase: InlineAIPhase) => void
}
