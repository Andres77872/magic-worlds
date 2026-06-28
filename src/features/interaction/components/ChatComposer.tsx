import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Images, ListChecks, RotateCcw, Send, Square, Volume2 } from 'lucide-react'
import { cx, IconButton } from '@/ui/primitives'
import { HighlightedTextarea, matcherIsEmpty, type TriggerMatcher } from '@/features/lorebook'

const MAX_LENGTH = 4000

interface ChatComposerProps {
    /** Controlled value — owned by the parent so forward-option chips can write to it. */
    value: string
    onValueChange: (next: string) => void
    /** Submit the message. The parent guards empty/isLoading/auth internally. */
    onSubmit: () => void
    /** Cancel the in-flight stream (parent's stopArmedRef-guarded handleStop). */
    onStop: () => void
    /** True while the GM/character is streaming a response. */
    isLoading: boolean
    /** True while a delete/clear mutation is in flight (gates send + secondary controls). */
    isMutating: boolean
    autoNarrate: boolean
    onToggleAutoNarrate: () => void
    generateImage: boolean
    onToggleGenerateImage: () => void
    suggestActions: boolean
    onToggleSuggestActions: () => void
    onReset: () => void
    /** Disable Reset when there is nothing to clear. */
    canReset: boolean
    placeholder: string
    /** When set, underline session-lore triggers as the player types (Ctrl/Cmd-click opens). */
    loreMatcher?: TriggerMatcher | null
}

/**
 * Roleplay message composer — a single rounded surface holding a multi-line,
 * auto-growing textarea and a slim toolbar (narrate + reset on the left, the
 * ember Send / Stop on the right).
 *
 * Deliberately not a <form>: under React 19's synchronous discrete-event
 * commits, swapping a type=submit button for Stop mid-click fires a phantom
 * submit, so both action buttons stay type="button" (matches AssistantComposer).
 *
 * The textarea is never disabled while streaming — the player can keep writing
 * their next move; only the *send* action is gated (it becomes Stop, and the
 * parent's submit no-ops while loading).
 */
export function ChatComposer({
    value,
    onValueChange,
    onSubmit,
    onStop,
    isLoading,
    isMutating,
    autoNarrate,
    onToggleAutoNarrate,
    generateImage,
    onToggleGenerateImage,
    suggestActions,
    onToggleSuggestActions,
    onReset,
    canReset,
    placeholder,
    loreMatcher,
}: ChatComposerProps) {
    const { t } = useTranslation()
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const showLoreHighlights = !matcherIsEmpty(loreMatcher)

    // Auto-grow: reset to `auto` so the box can shrink, then clamp to scrollHeight.
    // The element's max-height caps growth; longer text scrolls internally.
    const autoGrow = useCallback(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }, [])

    // Recompute height on any external value change too (forward-option chips
    // call setInput; send clears it) — those don't fire the textarea's onInput.
    useEffect(() => {
        autoGrow()
    }, [value, autoGrow])

    const submit = useCallback(() => {
        // Mirror the parent guard so Enter while streaming / empty / mutating is a no-op.
        if (!value.trim() || isLoading || isMutating) return
        onSubmit()
        // Parent clears `value`; reset the inline height and keep focus so the
        // player can immediately keep typing.
        requestAnimationFrame(() => {
            const el = textareaRef.current
            if (el) el.style.height = 'auto'
            el?.focus()
        })
    }, [value, isLoading, isMutating, onSubmit])

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
        }
    }

    const nearLimit = value.length >= MAX_LENGTH - 500

    return (
        <div className="mx-auto w-full max-w-[760px] px-4 py-3 md:px-6">
            <div
                className={cx(
                    'rounded-xl border border-parchment-50/[.13] bg-ink-700 transition-all',
                    'focus-within:border-ember-500 focus-within:shadow-[0_0_0_3px_rgba(232,162,74,.14)]',
                )}
            >
                {showLoreHighlights ? (
                    <HighlightedTextarea
                        value={value}
                        matcher={loreMatcher!}
                        textareaRef={textareaRef}
                        onChange={(e) => onValueChange(e.target.value)}
                        onInput={autoGrow}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        maxLength={MAX_LENGTH}
                        placeholder={placeholder}
                        ariaLabel={t('interaction.composer.messageLabel')}
                    />
                ) : (
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onValueChange(e.target.value)}
                        onInput={autoGrow}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        maxLength={MAX_LENGTH}
                        placeholder={placeholder}
                        aria-label={t('interaction.composer.messageLabel')}
                        className={cx(
                            'block max-h-[160px] min-h-[44px] w-full resize-none border-0 bg-transparent px-4 pb-1.5 pt-3',
                            'font-narrative text-[15px] leading-relaxed text-parchment-50 placeholder:text-parchment-400',
                            'focus:outline-none focus:ring-0',
                        )}
                    />
                )}

                <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                    <div className="flex items-center gap-1">
                        <IconButton
                            label={
                                autoNarrate
                                    ? t('interaction.composer.autoNarrateOn')
                                    : t('interaction.composer.autoNarrateOff')
                            }
                            size="sm"
                            tone={autoNarrate ? 'active' : 'default'}
                            aria-pressed={autoNarrate}
                            onClick={onToggleAutoNarrate}
                            disabled={isMutating}
                        >
                            <Volume2 size={17} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton
                            label={
                                generateImage
                                    ? t('interaction.composer.generatedImagesOn')
                                    : t('interaction.composer.generatedImagesOff')
                            }
                            size="sm"
                            tone={generateImage ? 'active' : 'default'}
                            aria-pressed={generateImage}
                            onClick={onToggleGenerateImage}
                            disabled={isMutating}
                        >
                            <Images size={17} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton
                            label={
                                suggestActions
                                    ? t('interaction.composer.suggestedActionsOn')
                                    : t('interaction.composer.suggestedActionsOff')
                            }
                            size="sm"
                            tone={suggestActions ? 'active' : 'default'}
                            aria-pressed={suggestActions}
                            onClick={onToggleSuggestActions}
                            disabled={isMutating}
                        >
                            <ListChecks size={17} strokeWidth={1.75} />
                        </IconButton>
                        <IconButton
                            label={t('interaction.composer.clearMessages')}
                            size="sm"
                            tone="danger"
                            onClick={onReset}
                            disabled={isLoading || isMutating || !canReset}
                        >
                            <RotateCcw size={16} strokeWidth={1.75} />
                        </IconButton>
                        {nearLimit && (
                            <span className="ml-1 font-mono text-[11px] text-parchment-400">
                                {value.length}/{MAX_LENGTH}
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <button
                            type="button"
                            onClick={onStop}
                            aria-label={t('interaction.composer.stopResponse')}
                            title={t('interaction.composer.stopResponse')}
                            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-blood-500/40 bg-blood-500/10 text-blood-500 transition-colors hover:bg-blood-500/25"
                        >
                            <Square size={15} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!value.trim() || isMutating}
                            aria-label={t('interaction.composer.sendMessage')}
                            title={t('interaction.composer.sendMessage')}
                            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md bg-ember-500 text-on-ember transition-all hover:bg-ember-400 hover:shadow-glow-ember active:scale-[.98] disabled:pointer-events-none disabled:opacity-50"
                        >
                            <Send size={17} strokeWidth={1.75} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
