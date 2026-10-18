import type { TextGenerationOptions } from '@/shared/types/textGeneration.types'
import { llmRecoveryMessage } from '@/features/llmProfiles/llmRecovery'
import { frameBatch } from '@/utils/frameBatch'
/**
 * useInlineAI — orchestrates the inline suggestion lifecycle around the
 * AiSuggestion extension: flush-save → generate (stale-token guarded) → insert
 * the whole generation in one transaction → accept / regenerate / decline,
 * including explicit acceptance and Escape semantics per phase.
 * The extension owns the document and the phase; this hook owns everything
 * async.
 *
 * `lastRequest` is what makes Regenerate possible without reopening the
 * composer — and it carries `isReplace`, because that flag decides whether the
 * generation flows inline into the host paragraph or lands as its own blocks.
 * Losing it would silently mis-shape every regenerated rewrite.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import type { StoryGeneration, StoryGenerationCommand } from '@/shared'
import { wordCount,plainTextWordCount } from '../../utils/novelUtils'
import type { InlineAIPhase, SavedGenerationReview } from '../types'
import { savedGenerationTarget } from '../savedGenerationTarget'
import { editorCursorOffset, editorRangeSelection, type DocumentSelection } from '../documentSelection'
import { aiTrackKey } from '../extensions/aiSuggestion'
import type { StoryVariantSnapshot } from '@/shared/types/storyVariant.types'
import { documentText } from '@/shared/storyDocument'

// Commands that REPLACE a selected passage rather than adding after it. 'custom'
// is here because a beat fired on a selection means "do this to that passage".
const SELECTION_COMMANDS: ReadonlySet<StoryGenerationCommand> = new Set(['rewrite', 'expand', 'condense', 'custom'])

export interface InlineAISubmitOptions {
    /** Markdown offsets for the backend prompt. */
    selection?: DocumentSelection
    /** Document range the suggestion replaces (rewrite/expand/condense). */
    replaceRange?: { from: number; to: number }
    /** Row anchor; defaults to the current selection end. */
    anchorPos?: number
    /** The writer's own words, shown back to them while the beat is alive. */
    prompt?: string
}

/** Everything needed to replay a request verbatim. */
interface InlineAIRequestState {
    command: StoryGenerationCommand
    instruction?: string
    selection?: DocumentSelection
    cursorOffset?: number
    /** Drives `inline` on insert — replayed generations must land the same shape. */
    isReplace: boolean
    /** Words the request replaced, for the row's readout. */
    replacedWords: number | null
    /** The writer's own words. Replayed with the request, so Regenerate keeps it. */
    prompt?: string
}

export interface InlineAICallbacks {
    /** Persist the draft; resolves false when the body could not be saved. */
    onRequestSaveFlush: () => Promise<boolean>
    onGenerate: (request: {
        command: StoryGenerationCommand
        instruction?: string
        selection?: DocumentSelection
        cursorOffset?: number
        prompt?: string
    }, options?: TextGenerationOptions) => Promise<StoryGeneration>
    onAcceptGeneration: (generationId: string, variant?: StoryVariantSnapshot) => Promise<void>
    onDiscardGeneration: (generationId: string) => Promise<void>
    onCritiquePreview?: (text: string, state: 'generating' | 'saving' | 'interrupted' | 'failed') => void
    onCritiqueResult: (generation: StoryGeneration) => void
}

export interface InlineAIRowMeta {
    versionTitle?: string
    words: number
    preview?: string
    stage?: string
    /** Words of the writer's own prose that the generation replaced, if any. */
    previous: number | null
    /** What was asked for. Null for the canned commands, which have no prompt. */
    prompt: string | null
}

export interface InlineAIApi {
    submit: (command: StoryGenerationCommand, instruction?: string, options?: InlineAISubmitOptions) => Promise<void>
    reviewGeneration: (review: SavedGenerationReview) => boolean
    accept: () => Promise<void>
    reject: () => Promise<void>
    /** Same instruction, same place, no prompt surface. */
    regenerate: () => Promise<void>
    abortPending: () => void
    /** Resolve whatever is live (used before chapter switches/unmount). */
    resolve: (mode: 'accept' | 'reject') => Promise<void>
    /** Phase-aware Escape handler for the extension keymap. */
    handleEscape: (phase: InlineAIPhase) => void
    /** False until a request has run in this session — the row hides Regenerate. */
    canRegenerate: boolean
    rowMeta: InlineAIRowMeta
    error: string | null
    clearError: () => void
}

export function useInlineAI(editor: Editor | null, callbacks: InlineAICallbacks): InlineAIApi {
    const { t } = useTranslation()
    const editorRef = useRef(editor)
    const callbacksRef = useRef(callbacks)
    const tRef = useRef(t)
    useEffect(() => {
        editorRef.current = editor
        callbacksRef.current = callbacks
        tRef.current = t
    })

    const [error, setError] = useState<string | null>(null)
    const [canRegenerate, setCanRegenerate] = useState(false)
    const [rowMeta, setRowMeta] = useState<InlineAIRowMeta>({ words: 0, previous: null, prompt: null })
    // Stale-response guard: bumping the token orphans any in-flight request.
    const tokenRef = useRef(0)
    const controllerRef = useRef<AbortController | null>(null)
    useEffect(() => () => { tokenRef.current += 1; controllerRef.current?.abort() }, [])
    const generationRef = useRef<StoryGeneration | null>(null)
    const variantRef = useRef<StoryVariantSnapshot | null>(null)
    const lastRequestRef = useRef<InlineAIRequestState | null>(null)
    const resolvingRef = useRef(false)

    const phase = useCallback((): InlineAIPhase => editorRef.current?.storage.aiSuggestionState.phase ?? 'idle', [])

    /**
     * The half of a request that runs after the anchor is armed. Shared by the
     * first submit and by regenerate, so a replay can never diverge — including
     * the save flush, which regenerate needs just as much: the backend generates
     * from the STORED chapter body, so skipping it would work from stale text.
     */
    const runGeneration = useCallback(async (request: InlineAIRequestState, token: number) => {
        setError(null)
        // Published before the request goes out: the prompt belongs on the row
        // from the first "Generating…" frame, not only once prose exists.
        setRowMeta({ words: 0, previous: request.replacedWords, prompt: request.prompt ?? null })
        const controller = new AbortController()
        controllerRef.current?.abort()
        controllerRef.current = controller
        let preview = ''
        if (request.command === 'critique') callbacksRef.current.onCritiquePreview?.('', 'generating')
        const updates = frameBatch<string>((chunks) => {
            if (token !== tokenRef.current) return
            preview += chunks.join('')
            if (request.command === 'critique') callbacksRef.current.onCritiquePreview?.(preview, 'generating')
            else setRowMeta((current) => ({ ...current, preview, words: wordCount(preview) }))
        })
        try {
            const saved = await callbacksRef.current.onRequestSaveFlush()
            if (!saved) {
                if (token === tokenRef.current) {
                    editorRef.current?.commands.aiCancelPending()
                    setError(tRef.current('novelEditor.editor.flushFailed'))
                }
                return
            }
            // The flush can take a while; Escape during it already cancelled the
            // request, and firing the model anyway costs the user a generation.
            if (token !== tokenRef.current) return
            const editorNow = editorRef.current
            if (!editorNow) return
            const track = aiTrackKey.getState(editorNow.state)
            const cursor = track?.pendingRange?.to ?? track?.pendingPos
            const mappedCursor=cursor!=null?editorCursorOffset(editorNow,cursor):null
            if(mappedCursor===null){
                editorNow.commands.aiCancelPending()
                setError(tRef.current('novelEditor.editor.flushFailed'))
                return
            }
            request.cursorOffset=mappedCursor
            if (request.isReplace && track?.pendingRange) {
                const selection = editorRangeSelection(editorNow, track.pendingRange.from, track.pendingRange.to)
                if (!selection) {
                    editorNow.commands.aiCancelPending()
                    setError(tRef.current('novelEditor.editor.flushFailed'))
                    return
                }
                request.selection = selection
            }
            const generation = await callbacksRef.current.onGenerate({
                command: request.command,
                instruction: request.instruction,
                selection: request.selection,
                cursorOffset: request.cursorOffset,
                prompt: request.prompt,
            }, {
                signal: controller.signal,
                onEvent: (event) => {
                    if (token !== tokenRef.current || controller.signal.aborted) return
                    if (event.type === 'delta') updates.push(event.delta)
                    if (event.type === 'progress') {
                        updates.flush()
                        setRowMeta((current) => ({ ...current, stage: event.stage }))
                        if (request.command === 'critique') callbacksRef.current.onCritiquePreview?.(preview, event.stage === 'saving' ? 'saving' : 'generating')
                    }
                },
            })
            updates.flush()
            const target = editorRef.current
            if (token !== tokenRef.current || !target || target.storage.aiSuggestionState.phase !== 'pending') {
                // Aborted while in flight — record the discard quietly.
                void callbacksRef.current.onDiscardGeneration(generation.id).catch(() => {})
                return
            }
            if (request.command === 'critique') {
                target.commands.aiCancelPending()
                callbacksRef.current.onCritiqueResult(generation)
                return
            }
            if (!generation.output.trim()) {
                target.commands.aiCancelPending()
                setError(tRef.current('novelEditor.editor.emptyGeneration'))
                return
            }
            const json = target.markdown!.parse(generation.output)
            if (!target.commands.aiInsertGeneration(json, { inline: request.isReplace, prompt: request.prompt })) {
                target.commands.aiCancelPending()
                setError(tRef.current('novelEditor.editor.emptyGeneration'))
                void callbacksRef.current.onDiscardGeneration(generation.id).catch(() => {})
                return
            }
            generationRef.current = generation
            variantRef.current = null
            setRowMeta({ words: wordCount(generation.output), previous: request.replacedWords, prompt: request.prompt ?? null })
        } catch (generateError) {
            updates.flush()
            if (token === tokenRef.current && request.command === 'critique') callbacksRef.current.onCritiquePreview?.(preview, 'failed')
            if (token === tokenRef.current && !controller.signal.aborted) {
                editorRef.current?.commands.aiCancelPending()
                setError(
                    llmRecoveryMessage(generateError, tRef.current)
                        ?? (generateError instanceof Error
                            ? generateError.message
                            : tRef.current('novelEditor.editor.generationFailed')),
                )
            }
        } finally {
            updates.cancel()
            if (controllerRef.current === controller) controllerRef.current = null
        }
    }, [])

    const submit = useCallback(
        async (command: StoryGenerationCommand, instruction?: string, options: InlineAISubmitOptions = {}) => {
            const editorNow = editorRef.current
            if (!editorNow) return
            const currentPhase = phase()
            if (currentPhase !== 'idle' && currentPhase !== 'prompting') return

            const isReplace = SELECTION_COMMANDS.has(command) && options.replaceRange != null
            const anchor = options.anchorPos ?? options.replaceRange?.to ?? editorNow.state.selection.to
            const cursorOffset=editorCursorOffset(editorNow,anchor)
            if(cursorOffset===null){setError(tRef.current('novelEditor.editor.flushFailed'));return}
            if (!editorNow.commands.aiStartPending(anchor, isReplace ? options.replaceRange : undefined)) return

            const request: InlineAIRequestState = {
                command,
                instruction: instruction?.trim() || undefined,
                selection: options.selection,
                cursorOffset,
                isReplace,
                replacedWords: isReplace && options.selection ? plainTextWordCount(options.selection.text) : null,
                prompt: options.prompt?.trim() || undefined,
            }
            lastRequestRef.current = request
            setCanRegenerate(command !== 'critique')
            await runGeneration(request, ++tokenRef.current)
        },
        [phase, runGeneration],
    )

    const reviewGeneration = useCallback((review: SavedGenerationReview) => {
        const editorNow = editorRef.current
        if (!editorNow || phase() !== 'idle') return false
        const target = savedGenerationTarget(editorNow, review)
        if (!target) return false
        try {
            const json = review.variant ? review.variant.operation.document.content : editorNow.markdown!.parse(review.generation.output)
            if (!editorNow.commands.aiStartPending(target.pos, target.range)) return false
            if (!editorNow.commands.aiInsertGeneration(json, { inline: target.inline, exactSnapshot: Boolean(review.variant) })) {
                editorNow.commands.aiCancelPending(); return false
            }
        } catch {
            if (phase() === 'pending') editorNow.commands.aiCancelPending()
            return false
        }
        tokenRef.current++
        generationRef.current = structuredClone(review.generation)
        variantRef.current = review.variant ? structuredClone(review.variant) : null
        lastRequestRef.current = null
        setCanRegenerate(false)
        setError(null)
        setRowMeta({ words: review.variant ? plainTextWordCount(documentText(review.variant.operation.document)) : wordCount(review.generation.output),
            previous: review.variant ? plainTextWordCount(documentText(review.variant.baseDocument)) : review.generation.inputRange ? plainTextWordCount(review.generation.inputRange.text) : null,
            ...(review.variant ? { versionTitle: review.variant.title } : {}),
            prompt: review.generation.instruction ?? null })
        return true
    }, [phase])

    const accept = useCallback(async () => {
        const editorNow = editorRef.current
        if (!editorNow || phase() !== 'reviewing') return
        const generation = generationRef.current
        const variant = variantRef.current
        if (!editorNow.chain().aiAccept().focus(undefined, { scrollIntoView: false }).run()) {
            setError(tRef.current('novelEditor.editor.flushFailed')); return
        }
        generationRef.current = null
        variantRef.current = null
        try {
            if (generation) {
                if (variant) await callbacksRef.current.onAcceptGeneration(generation.id, variant)
                else await callbacksRef.current.onAcceptGeneration(generation.id)
            }
        } catch (acceptError) {
            // Non-fatal: the text is kept either way; the generation simply
            // stays a candidate server-side.
            setError(acceptError instanceof Error ? acceptError.message : tRef.current('novelEditor.editor.flushFailed'))
        }
    }, [phase])

    const reject = useCallback(async () => {
        const editorNow = editorRef.current
        if (!editorNow) return
        if (phase() === 'pending') {
            tokenRef.current += 1
            controllerRef.current?.abort()
            editorNow.commands.aiCancelPending()
            return
        }
        if (phase() !== 'reviewing') return
        const generation = generationRef.current
        const variant = variantRef.current
        generationRef.current = null
        variantRef.current = null
        editorNow.chain().aiReject().focus(undefined, { scrollIntoView: false }).run()
        // Closing an authored review retains that saved version and its original
        // model parent. Explicit version rejection is a separate saved decision.
        if (generation && !variant) {
            try {
                await callbacksRef.current.onDiscardGeneration(generation.id)
            } catch (discardError) {
                console.warn('Failed to record generation discard:', discardError)
            }
        }
    }, [phase])

    const abortPending = useCallback(() => {
        if (phase() !== 'pending') return
        if (lastRequestRef.current?.command === 'critique') callbacksRef.current.onCritiquePreview?.('', 'interrupted')
        tokenRef.current += 1
        controllerRef.current?.abort()
        setRowMeta((current) => ({ ...current, preview: undefined, stage: undefined }))
        editorRef.current?.commands.aiCancelPending()
    }, [phase])

    const regenerate = useCallback(async () => {
        const editorNow = editorRef.current
        const request = lastRequestRef.current
        // Guarded rather than asserted: a remount or a restored suggestion can
        // reach `reviewing` with no request behind it.
        if (!editorNow || !request || phase() !== 'reviewing') return
        const superseded = generationRef.current
        generationRef.current = null
        if (superseded) {
            void callbacksRef.current.onDiscardGeneration(superseded.id).catch(() => {})
        }
        // One transaction: the candidate goes, the writer's own prose comes back,
        // and the same anchor is re-armed as pending.
        if (!editorNow.commands.aiRegenerate()) return
        await runGeneration(request, ++tokenRef.current)
    }, [phase, runGeneration])

    const resolve = useCallback(
        async (mode: 'accept' | 'reject') => {
            if (resolvingRef.current) return
            resolvingRef.current = true
            try {
                const currentPhase = phase()
                if (currentPhase === 'pending') abortPending()
                else if (currentPhase === 'reviewing') {
                    if (mode === 'accept') await accept()
                    else await reject()
                }
            } finally {
                resolvingRef.current = false
            }
        },
        [abortPending, accept, phase, reject],
    )

    const handleEscape = useCallback(
        (escapePhase: InlineAIPhase) => {
            if (escapePhase === 'pending') abortPending()
            else if (escapePhase === 'reviewing') void reject()
        },
        [abortPending, reject],
    )

    return {
        submit,
        reviewGeneration,
        accept,
        reject,
        regenerate,
        abortPending,
        resolve,
        handleEscape,
        canRegenerate,
        rowMeta,
        error,
        clearError: () => setError(null),
    }
}
