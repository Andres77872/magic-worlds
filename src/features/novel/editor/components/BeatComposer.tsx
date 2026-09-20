/**
 * BeatComposer — the one place you tell the AI what to do.
 *
 * Reached from "/" → Beat, from ⌘⏎ at the caret, and from the selection
 * toolbar's Beat. It is an INPUT surface only: the generated prose is written
 * straight into the manuscript and reviewed there, so nothing is ever previewed
 * here.
 *
 * It opens as one instruction box. Length and the context readout fold away
 * behind a disclosure, because on nine openings out of ten the only thing a
 * writer wants is to type a sentence and hit Enter — but the collapsed toggle
 * still names the current length, so folding hides the controls, never the
 * state.
 *
 * The instruction lives in React state rather than in the document — see
 * useBeatComposer for why that matters. Enter writes, Shift+Enter is a newline,
 * Escape cancels.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { Button, Chip, Icon } from '@/ui/primitives'
import type { BeatLength } from '../types'

interface BeatComposerProps {
    anchor: { left: number; top: number; caretTop: number }
    /** The editor's scrollport — the composer flips above the caret inside it. */
    containerRef: RefObject<HTMLElement | null>
    instruction: string
    length: BeatLength
    /** Where the prose will land, in words: "after “…he agreed.”" or the selection. */
    contextLine: string
    /** Enabled codex entries — the same count the codex panel reports. */
    contextCount: number
    /** Changes the placeholder: a beat on a passage is not a continuation. */
    targetsSelection: boolean
    optionsOpen: boolean
    onToggleOptions: () => void
    onInstructionChange: (value: string) => void
    onLengthChange: (value: BeatLength) => void
    onSubmit: () => void
    onCancel: () => void
}

const LENGTHS: readonly BeatLength[] = ['short', 'medium', 'long']

/** Roughly eight lines of the composer's own type before it starts scrolling. */
const MAX_TEXTAREA_HEIGHT = 176

export function BeatComposer({
    anchor,
    containerRef,
    instruction,
    length,
    contextLine,
    contextCount,
    targetsSelection,
    optionsOpen,
    onToggleOptions,
    onInstructionChange,
    onLengthChange,
    onSubmit,
    onCancel,
}: BeatComposerProps) {
    const { t } = useTranslation()
    const rootRef = useRef<HTMLDivElement | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const optionsRef = useRef<HTMLDivElement | null>(null)
    const optionsId = useId()
    // Was the disclosure already open when this composer mounted? If so it was
    // restored from storage, not opened by the writer, and focus belongs in the
    // instruction box.
    const wasOpen = useRef(optionsOpen)

    useEffect(() => {
        const node = textareaRef.current
        if (!node) return
        node.focus()
        // Caret to the end so a prefilled instruction can be extended, not retyped.
        node.setSelectionRange(node.value.length, node.value.length)
    }, [])

    // Land in what you just revealed. Only on a real transition: on mount the
    // disclosure may already be open from storage, and stealing focus from the
    // instruction box then would be a trap of its own.
    useEffect(() => {
        if (optionsOpen && !wasOpen.current) {
            optionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
        }
        wasOpen.current = optionsOpen
    }, [optionsOpen])

    // Grow with the instruction instead of scrolling three lines of it. Written
    // straight to the node: a measured height in state would re-render on every
    // keystroke to tell React something it cannot compute anyway.
    const autoGrow = useCallback(() => {
        const node = textareaRef.current
        if (!node || !node.scrollHeight) return
        node.style.height = 'auto'
        node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
    }, [])

    // Expanding the options, or a long instruction, can push the composer past
    // the bottom of the scrollport. Flip it above the caret when that happens,
    // clamped to the top of the visible band — falling back to the position we
    // already know overflows would teleport the box the writer is typing in.
    // `left` is re-clamped too: it was measured against the scrollport when the
    // composer opened, and a narrower one would otherwise push the right edge
    // out and grow the horizontal scrollbar popoverAnchor exists to prevent.
    const place = useCallback(() => {
        const node = rootRef.current
        const container = containerRef.current
        if (!node || !container) return
        const height = node.offsetHeight
        if (!height) return
        const above = anchor.caretTop - height - 6
        const overflows = anchor.top + height > container.scrollTop + container.clientHeight
        node.style.top = `${overflows ? Math.max(above, container.scrollTop) : anchor.top}px`
        node.style.left = `${Math.min(anchor.left, Math.max(8, container.clientWidth - node.offsetWidth - 8))}px`
    }, [anchor.caretTop, anchor.left, anchor.top, containerRef])

    useLayoutEffect(() => {
        autoGrow()
        place()
    }, [autoGrow, instruction, optionsOpen, place])

    // The anchor is frozen in content coordinates, so scrolling slides the
    // visible band under a composer that cannot otherwise re-decide whether to
    // flip; a resize changes both the left clamp and how the instruction wraps.
    useEffect(() => {
        const container = containerRef.current
        const onResize = () => {
            autoGrow()
            place()
        }
        container?.addEventListener('scroll', place, { passive: true })
        window.addEventListener('resize', onResize)
        return () => {
            container?.removeEventListener('scroll', place)
            window.removeEventListener('resize', onResize)
        }
    }, [autoGrow, containerRef, place])

    // Escape and an outside click dismiss it wherever focus happens to be —
    // clicking a length chip or the disclosure moves focus out of the textarea,
    // and a composer that can only be closed from one control is a trap.
    useEffect(() => {
        const onPointer = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) onCancel()
        }
        const onKey = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            onCancel()
        }
        // Capture: the editor's own handlers must not swallow the click first.
        document.addEventListener('mousedown', onPointer, true)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer, true)
            document.removeEventListener('keydown', onKey)
        }
    }, [onCancel])

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
            return
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit()
        }
    }

    return (
        <div
            ref={rootRef}
            className="absolute z-40 w-[420px] max-w-[calc(100%-16px)] overflow-hidden rounded-md border border-arcane-500/40 bg-ink-700 shadow-lg"
            style={{ left: anchor.left, top: anchor.top }}
            data-testid="beat-composer"
        >
            <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
                <span className="text-arcane-400">
                    <Icon icon={Sparkles} size={14} />
                </span>
                <span className="font-ui text-caption font-semibold uppercase tracking-[0.06em] text-arcane-300">
                    {t('novelEditor.beat.title')}
                </span>
                <span className="min-w-0 truncate font-ui text-caption text-parchment-400">{contextLine}</span>
            </div>

            <div className="px-3 pb-2.5">
                <textarea
                    ref={textareaRef}
                    rows={2}
                    value={instruction}
                    onChange={(event) => onInstructionChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t(targetsSelection ? 'novelEditor.beat.placeholderSelection' : 'novelEditor.beat.placeholder')}
                    aria-label={t('novelEditor.beat.title')}
                    className="w-full resize-none rounded-md border border-parchment-50/[.14] bg-ink-900/55 px-2.5 py-2 font-ui text-body text-parchment-100 outline-none transition-colors placeholder:text-parchment-500 focus-visible:border-arcane-500/65 focus-visible:shadow-input-focus-arcane"
                    data-testid="beat-instruction"
                />
            </div>

            {optionsOpen && (
                <div ref={optionsRef} id={optionsId} className="px-3 pb-2.5" data-testid="beat-options">
                    <div className="flex flex-wrap items-center gap-2">
                        <span id={`${optionsId}-length`} className="font-ui text-meta text-parchment-400">
                            {t('novelEditor.beat.length')}
                        </span>
                        {/* A named group, so a screen reader announces three
                            pressed-states as one choice. The hint stays outside it
                            or it is read as a fourth member. */}
                        <div role="group" aria-labelledby={`${optionsId}-length`} className="flex items-center gap-2">
                            {LENGTHS.map((value) => (
                                <Chip
                                    key={value}
                                    active={value === length}
                                    onClick={() => onLengthChange(value)}
                                    aria-pressed={value === length}
                                    data-testid={`beat-length-${value}`}
                                >
                                    {t(`novelEditor.beat.${value}`)}
                                </Chip>
                            ))}
                        </div>
                        <span className="w-full font-ui text-meta text-parchment-400">
                            {t(`novelEditor.beat.${length}Hint`)}
                        </span>
                    </div>
                    <p className="m-0 mt-2 truncate font-ui text-meta text-parchment-400">
                        {t('novelEditor.beat.context', { count: contextCount })}
                    </p>
                </div>
            )}

            <div className="flex items-center gap-2 border-t border-parchment-50/[.08] px-3 py-2">
                <button
                    type="button"
                    onClick={onToggleOptions}
                    aria-expanded={optionsOpen}
                    aria-controls={optionsOpen ? optionsId : undefined}
                    className="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-xs px-1 py-0.5 font-ui text-meta text-parchment-400 transition-colors hover:text-parchment-100"
                    data-testid="beat-options-toggle"
                >
                    {/* The revealed region sits above this control in the DOM, so
                        expanding moves focus into it rather than leaving a keyboard
                        user to Shift+Tab backwards for what they just opened. */}
                    <Icon icon={optionsOpen ? ChevronDown : ChevronRight} size={13} />
                    <span className="truncate">
                        {optionsOpen
                            ? t('novelEditor.beat.options')
                            : t('novelEditor.beat.optionsSummary', { length: t(`novelEditor.beat.${length}`) })}
                    </span>
                </button>
                <span className="flex-1" />
                <Button variant="ghost" size="sm" onClick={onCancel}>
                    {t('novelEditor.beat.cancel')}
                </Button>
                <Button variant="primary" size="sm" onClick={onSubmit} data-testid="beat-write">
                    {t('novelEditor.beat.write')}
                </Button>
            </div>
        </div>
    )
}
