/**
 * HighlightedTextarea — the chat composer's textarea with an aligned backdrop that
 * paints arcane underlines under any word matching session lore.
 *
 * Technique: a backdrop mirror renders the same text (with `.lore-trigger` spans) while
 * the textarea on top keeps its text transparent but its caret visible. The backdrop is
 * never interactive (`pointer-events: none`), so typing, selection, and caret placement
 * behave exactly as a plain textarea. Opening is handled on the textarea itself: a
 * Ctrl/Cmd-click reads the caret offset and opens the entry whose range contains it —
 * no fragile click-through layering. Holding Ctrl/Cmd "arms" the field (pointer cursor +
 * brighter marks) as an affordance.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent, RefObject, UIEvent } from 'react'
import { cx } from '@/ui/primitives'
import { scanText, segmentText, type TriggerMatcher } from '../loreTriggers'
import { useOpenLoreEntry } from '../hooks/useOpenLoreEntry'

// Typography/box classes shared by the textarea and the backdrop — they MUST match
// exactly or the underlines drift off the glyphs. (Mirrors ChatComposer's textarea.)
const BOX = 'block max-h-[160px] min-h-[44px] w-full px-4 pb-1.5 pt-3 font-narrative text-[15px] leading-relaxed'

interface HighlightedTextareaProps {
    value: string
    matcher: TriggerMatcher
    textareaRef: RefObject<HTMLTextAreaElement | null>
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
    onInput?: () => void
    onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
    placeholder?: string
    ariaLabel?: string
    maxLength?: number
    rows?: number
}

export function HighlightedTextarea({
    value,
    matcher,
    textareaRef,
    onChange,
    onInput,
    onKeyDown,
    placeholder,
    ariaLabel,
    maxLength,
    rows = 1,
}: HighlightedTextareaProps) {
    const backdropRef = useRef<HTMLDivElement | null>(null)
    const openEntry = useOpenLoreEntry()
    const [armed, setArmed] = useState(false)

    const segments = useMemo(() => segmentText(value, scanText(value, matcher)), [value, matcher])

    // Track the Ctrl/Cmd modifier globally so we can show the "openable" affordance and
    // reset it on blur (a key release outside the window would otherwise stick).
    useEffect(() => {
        const sync = (event: globalThis.KeyboardEvent) => setArmed(event.ctrlKey || event.metaKey)
        const reset = () => setArmed(false)
        window.addEventListener('keydown', sync)
        window.addEventListener('keyup', sync)
        window.addEventListener('blur', reset)
        return () => {
            window.removeEventListener('keydown', sync)
            window.removeEventListener('keyup', sync)
            window.removeEventListener('blur', reset)
        }
    }, [])

    const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
        const backdrop = backdropRef.current
        if (!backdrop) return
        backdrop.scrollTop = event.currentTarget.scrollTop
        backdrop.scrollLeft = event.currentTarget.scrollLeft
    }

    const handleClick = (event: MouseEvent<HTMLTextAreaElement>) => {
        if (!(event.ctrlKey || event.metaKey)) return
        const el = textareaRef.current
        if (!el) return
        const pos = el.selectionStart ?? 0
        const hit = scanText(el.value, matcher).find((match) => pos >= match.start && pos <= match.end)
        if (hit) {
            event.preventDefault()
            openEntry(hit)
        }
    }

    return (
        <div className="relative">
            <div
                ref={backdropRef}
                aria-hidden="true"
                className={cx(
                    BOX,
                    'pointer-events-none absolute inset-0 z-0 select-none overflow-hidden whitespace-pre-wrap break-words text-parchment-50',
                    armed && 'is-armed',
                )}
            >
                {segments.map((segment, index) =>
                    segment.match ? (
                        <span key={index} className="lore-trigger">
                            {segment.text}
                        </span>
                    ) : (
                        <span key={index}>{segment.text}</span>
                    ),
                )}
                {/* trailing zero-width char keeps the last line's height in sync with the textarea */}
                {'​'}
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                onInput={onInput}
                onKeyDown={onKeyDown}
                onScroll={syncScroll}
                onClick={handleClick}
                rows={rows}
                maxLength={maxLength}
                placeholder={placeholder}
                aria-label={ariaLabel}
                style={{ color: 'transparent', caretColor: 'var(--color-parchment-50)' }}
                className={cx(
                    BOX,
                    'relative z-[1] resize-none border-0 bg-transparent placeholder:text-parchment-400',
                    'focus:outline-none focus:ring-0',
                    armed && 'cursor-pointer',
                )}
            />
        </div>
    )
}
