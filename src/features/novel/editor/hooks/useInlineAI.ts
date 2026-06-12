/**
 * useInlineAI — orchestrates the inline suggestion lifecycle around the
 * AiSuggestion extension: flush-save → generate (stale-token guarded) →
 * typewriter reveal → accept/reject, including the implicit accept on user
 * edits and Escape semantics per phase. The extension owns the document and
 * the phase; this hook owns everything async.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { StoryGeneration, StoryGenerationCommand } from '@/shared'
import type { InlineAIPhase } from '../types'
import { buildRevealPlan, type RevealStep } from '../extensions/revealPlan'
import type { MarkdownSelection } from '../markdownSelection'

const REVEAL_TICK_MS = 18

const SELECTION_COMMANDS: ReadonlySet<StoryGenerationCommand> = new Set(['rewrite', 'expand', 'condense'])

export interface InlineAISubmitOptions {
    /** Markdown offsets for the backend prompt. */
    selection?: MarkdownSelection
    /** Document range the suggestion replaces (rewrite/expand/condense). */
    replaceRange?: { from: number; to: number }
    /** Pending-widget anchor; defaults to the current selection end. */
    anchorPos?: number
}

export interface InlineAICallbacks {
    onRequestSaveFlush: () => Promise<void>
    onGenerate: (request: {
        command: StoryGenerationCommand
        instruction?: string
        selection?: MarkdownSelection
    }) => Promise<StoryGeneration>
    onAcceptGeneration: (generationId: string) => Promise<void>
    onDiscardGeneration: (generationId: string) => Promise<void>
    onCritiqueResult: (generation: StoryGeneration) => void
}

export interface InlineAIApi {
    submit: (command: StoryGenerationCommand, instruction?: string, options?: InlineAISubmitOptions) => Promise<void>
    accept: () => Promise<void>
    reject: () => Promise<void>
    abortPending: () => void
    fastForward: () => void
    /** Resolve whatever is live (used before chapter switches/unmount). */
    resolve: (mode: 'accept' | 'reject') => Promise<void>
    /** Phase-aware Escape handler for the extension keymap. */
    handleEscape: (phase: InlineAIPhase) => void
    handleImplicitAccept: () => void
    error: string | null
    clearError: () => void
}

export function useInlineAI(editor: Editor | null, callbacks: InlineAICallbacks): InlineAIApi {
    const editorRef = useRef(editor)
    const callbacksRef = useRef(callbacks)
    useEffect(() => {
        editorRef.current = editor
        callbacksRef.current = callbacks
    })

    const [error, setError] = useState<string | null>(null)
    // Stale-response guard: bumping the token orphans any in-flight request.
    const tokenRef = useRef(0)
    const generationRef = useRef<StoryGeneration | null>(null)
    const stepsRef = useRef<RevealStep[]>([])
    const stepIndexRef = useRef(0)
    const timerRef = useRef<number | null>(null)
    const resolvingRef = useRef(false)

    const clearTimer = useCallback(() => {
        if (timerRef.current != null) {
            window.clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    useEffect(() => clearTimer, [clearTimer])

    const phase = useCallback((): InlineAIPhase => editorRef.current?.storage.aiSuggestionState.phase ?? 'idle', [])

    const finishReveal = useCallback(() => {
        clearTimer()
        editorRef.current?.commands.aiFinishReveal()
    }, [clearTimer])

    const fastForward = useCallback(() => {
        if (phase() !== 'revealing') return
        clearTimer()
        const editorNow = editorRef.current
        if (!editorNow) return
        while (stepIndexRef.current < stepsRef.current.length) {
            editorNow.commands.aiInsertStep(stepsRef.current[stepIndexRef.current])
            stepIndexRef.current += 1
        }
        finishReveal()
    }, [clearTimer, finishReveal, phase])

    const accept = useCallback(async () => {
        const editorNow = editorRef.current
        if (!editorNow) return
        if (phase() === 'revealing') fastForward()
        if (phase() !== 'reviewing') return
        const generation = generationRef.current
        generationRef.current = null
        editorNow.commands.aiAccept()
        try {
            await callbacksRef.current.onRequestSaveFlush()
            if (generation) await callbacksRef.current.onAcceptGeneration(generation.id)
        } catch (acceptError) {
            // Non-fatal: the text is kept either way; the generation simply
            // stays a candidate server-side.
            console.warn('Failed to record generation acceptance:', acceptError)
        }
    }, [fastForward, phase])

    const reject = useCallback(async () => {
        const editorNow = editorRef.current
        if (!editorNow) return
        if (phase() !== 'revealing' && phase() !== 'reviewing') return
        clearTimer()
        const generation = generationRef.current
        generationRef.current = null
        editorNow.commands.aiReject()
        if (generation) {
            try {
                await callbacksRef.current.onDiscardGeneration(generation.id)
            } catch (discardError) {
                console.warn('Failed to record generation discard:', discardError)
            }
        }
    }, [clearTimer, phase])

    const abortPending = useCallback(() => {
        if (phase() !== 'pending') return
        tokenRef.current += 1
        editorRef.current?.commands.aiCancelPending()
    }, [phase])

    const startReveal = useCallback(
        (steps: RevealStep[]) => {
            const editorNow = editorRef.current
            if (!editorNow) return
            stepsRef.current = steps
            stepIndexRef.current = 0
            editorNow.commands.aiBeginReveal()
            if (steps.length === 0) {
                finishReveal()
                return
            }
            timerRef.current = window.setInterval(() => {
                const target = editorRef.current
                if (!target || target.storage.aiSuggestionState.phase !== 'revealing') {
                    clearTimer()
                    return
                }
                target.commands.aiInsertStep(stepsRef.current[stepIndexRef.current])
                stepIndexRef.current += 1
                if (stepIndexRef.current >= stepsRef.current.length) finishReveal()
            }, REVEAL_TICK_MS)
        },
        [clearTimer, finishReveal],
    )

    const submit = useCallback(
        async (command: StoryGenerationCommand, instruction?: string, options: InlineAISubmitOptions = {}) => {
            const editorNow = editorRef.current
            if (!editorNow) return
            const currentPhase = phase()
            if (currentPhase !== 'idle' && currentPhase !== 'prompting') return

            setError(null)
            const isReplace = SELECTION_COMMANDS.has(command) && options.replaceRange != null
            const anchor = options.anchorPos ?? options.replaceRange?.to ?? editorNow.state.selection.to
            if (!editorNow.commands.aiStartPending(anchor, isReplace ? options.replaceRange : undefined)) return

            const token = ++tokenRef.current
            try {
                await callbacksRef.current.onRequestSaveFlush()
                const generation = await callbacksRef.current.onGenerate({
                    command,
                    instruction: instruction?.trim() || undefined,
                    selection: options.selection,
                })
                const target = editorRef.current
                if (token !== tokenRef.current || !target || target.storage.aiSuggestionState.phase !== 'pending') {
                    // Aborted while in flight — record the discard quietly.
                    void callbacksRef.current.onDiscardGeneration(generation.id).catch(() => {})
                    return
                }
                if (command === 'critique') {
                    target.commands.aiCancelPending()
                    callbacksRef.current.onCritiqueResult(generation)
                    return
                }
                if (!generation.output.trim()) {
                    target.commands.aiCancelPending()
                    setError('The muse returned nothing — try rephrasing the instruction.')
                    return
                }
                generationRef.current = generation
                const json = target.markdown!.parse(generation.output)
                startReveal(buildRevealPlan(json, { inlineFirstBlock: isReplace }))
            } catch (generateError) {
                if (token === tokenRef.current) {
                    editorRef.current?.commands.aiCancelPending()
                    setError(generateError instanceof Error ? generateError.message : 'Generation failed — try again.')
                }
            }
        },
        [phase, startReveal],
    )

    const resolve = useCallback(
        async (mode: 'accept' | 'reject') => {
            if (resolvingRef.current) return
            resolvingRef.current = true
            try {
                const currentPhase = phase()
                if (currentPhase === 'pending') abortPending()
                else if (currentPhase === 'revealing' || currentPhase === 'reviewing') {
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
            else if (escapePhase === 'revealing') fastForward()
            else if (escapePhase === 'reviewing') void reject()
        },
        [abortPending, fastForward, reject],
    )

    const handleImplicitAccept = useCallback(() => {
        // Fired from within a transaction dispatch — defer our own dispatches.
        window.queueMicrotask(() => void accept())
    }, [accept])

    return {
        submit,
        accept,
        reject,
        abortPending,
        fastForward,
        resolve,
        handleEscape,
        handleImplicitAccept,
        error,
        clearError: () => setError(null),
    }
}
