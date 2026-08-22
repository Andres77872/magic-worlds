/**
 * useBeatComposer — the beat composer's controller: what to write, how much of
 * it, where it lands, and what the writer is told about that.
 *
 * The instruction deliberately never enters the manuscript. It used to be typed
 * after "/" as document text, so a whole free-text instruction sat in the
 * chapter while you wrote it. Only the short command query does now, which is
 * why the autosave suspension and the re-emit microtask in NovelEditor still
 * exist: they cover a few characters instead of a sentence.
 */

import { useCallback, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import type { StoryGenerationCommand } from '@/shared'
import { editorSelection, type MarkdownSelection } from '../markdownSelection'
import { popoverAnchor } from './useSuggestionMenu'
import type { BeatLength } from '../types'
import type { InlineAISubmitOptions } from './useInlineAI'

const LENGTH_STORAGE_KEY = 'magic_worlds:novel:beatLength'
const OPTIONS_STORAGE_KEY = 'magic_worlds:novel:beatOptions'

/** Appended to the instruction. English, like the rest of the server-side prompt. */
const LENGTH_INSTRUCTION: Record<BeatLength, string> = {
    short: 'Write about one paragraph.',
    medium: 'Write two or three paragraphs.',
    long: 'Write a full scene.',
}

/** Characters of preceding prose shown in the composer's context line. */
const PRECEDING_CHARS = 56

/** Must match BeatComposer's own width, or the right-edge clamp lies. */
const COMPOSER_WIDTH = 420

export interface BeatTarget {
    /** Markdown offsets for the backend prompt, when a passage is selected. */
    selection?: MarkdownSelection
    /** Document range the generation replaces. */
    replaceRange?: { from: number; to: number }
    /** Where the row and the generation are anchored. */
    anchorPos: number
    /** Caret coordinates, measured once when the composer opens. `caretTop` is
     *  where the composer flips to when it will not fit below. */
    anchor: { left: number; top: number; caretTop: number }
    /** The last words before the insertion point. */
    preceding: string
}

interface UseBeatComposerOptions {
    editorRef: RefObject<Editor | null>
    /** The editor's scrollport; the popover is positioned against it. */
    containerRef: RefObject<HTMLElement | null>
    submit: (
        command: StoryGenerationCommand,
        instruction?: string,
        options?: InlineAISubmitOptions,
    ) => Promise<void>
}

/** Folded by default: most beats are one typed sentence and Enter. */
function readOptionsOpen(): boolean {
    try {
        return window.localStorage.getItem(OPTIONS_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

function readLength(): BeatLength {
    try {
        const stored = window.localStorage.getItem(LENGTH_STORAGE_KEY)
        if (stored === 'short' || stored === 'medium' || stored === 'long') return stored
    } catch {
        // Storage unavailable — fall through to the default.
    }
    return 'medium'
}

/** Combine what the writer asked for with how much of it they want. */
export function beatInstruction(instruction: string, length: BeatLength): string {
    const trimmed = instruction.trim()
    const hint = LENGTH_INSTRUCTION[length]
    return trimmed ? `${trimmed}\n\n${hint}` : hint
}

export function useBeatComposer({ editorRef, containerRef, submit }: UseBeatComposerOptions) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [instruction, setInstruction] = useState('')
    const [length, setLengthState] = useState<BeatLength>(readLength)
    const [target, setTarget] = useState<BeatTarget | null>(null)
    const [optionsOpen, setOptionsOpen] = useState(readOptionsOpen)

    const toggleOptions = useCallback(() => {
        setOptionsOpen((value) => {
            const next = !value
            try {
                window.localStorage.setItem(OPTIONS_STORAGE_KEY, String(next))
            } catch {
                // Storage unavailable — keep the in-memory choice.
            }
            return next
        })
    }, [])

    const setLength = useCallback((value: BeatLength) => {
        setLengthState(value)
        try {
            window.localStorage.setItem(LENGTH_STORAGE_KEY, value)
        } catch {
            // Storage unavailable — keep the in-memory choice.
        }
    }, [])

    /** Open at the caret, or over the selection when there is one. */
    const openAt = useCallback(
        (prefill: string) => {
            const editor = editorRef.current
            const container = containerRef.current
            if (!editor || !container) return
            const { from, to } = editor.state.selection
            let coords: { left: number; top: number; bottom: number }
            try {
                coords = editor.view.coordsAtPos(to)
            } catch {
                return
            }
            const containerRect = container.getBoundingClientRect()
            const anchor = {
                ...popoverAnchor(container, coords.left, coords.bottom, COMPOSER_WIDTH),
                caretTop: coords.top - containerRect.top + container.scrollTop,
            }
            setInstruction(prefill)
            setTarget(
                to > from
                    ? {
                          selection: editorSelection(editor) ?? undefined,
                          replaceRange: { from, to },
                          anchorPos: to,
                          anchor,
                          preceding: '',
                      }
                    : {
                          anchorPos: to,
                          anchor,
                          preceding: editor.state.doc.textBetween(Math.max(0, to - PRECEDING_CHARS), to, ' ').trim(),
                      },
            )
            setOpen(true)
        },
        [containerRef, editorRef],
    )

    const cancel = useCallback(() => {
        setOpen(false)
        setTarget(null)
        editorRef.current?.commands.focus()
    }, [editorRef])

    const write = useCallback(() => {
        if (!target) return
        const typed = instruction.trim()
        // A beat with nothing typed is just a continuation — say that to the
        // model rather than sending an instruction that says nothing.
        const command: StoryGenerationCommand = target.replaceRange || typed ? 'custom' : 'continue'
        setOpen(false)
        setTarget(null)
        // Tab / Esc / Enter / Mod-Enter / Mod-z are ProseMirror keymap bindings,
        // so they are dead until the editor has DOM focus again. Cancel already
        // did this; writing has to as well, or the action row advertises keys
        // that do nothing. The anchor travelled with the request, so taking
        // focus back cannot move where the prose lands.
        editorRef.current?.commands.focus()
        void submit(command, beatInstruction(typed, length), {
            selection: target.selection,
            replaceRange: target.replaceRange,
            anchorPos: target.anchorPos,
            // The length sentence is for the model; this is for the writer.
            prompt: typed,
        })
    }, [editorRef, instruction, length, submit, target])

    const contextLine = target
        ? target.replaceRange
            ? t('novelEditor.beat.onSelection')
            : target.preceding
              ? t('novelEditor.beat.after', { text: target.preceding })
              : t('novelEditor.beat.atStart')
        : ''

    return {
        open,
        instruction,
        length,
        target,
        contextLine,
        optionsOpen,
        toggleOptions,
        setInstruction,
        setLength,
        openAt,
        cancel,
        write,
    }
}
