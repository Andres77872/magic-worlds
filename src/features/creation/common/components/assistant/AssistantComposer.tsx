import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Square } from 'lucide-react'
import { Textarea, IconButton, cx } from '@/ui/primitives'

const MAX_LENGTH = 4000

interface AssistantComposerProps {
    streaming: boolean
    disabled?: boolean
    placeholder?: string
    onSend: (text: string) => void
    onStop: () => void
    /** Extra classes for the outer band (e.g. a page-level framed composer). */
    className?: string
    /** Controlled text lets a feature retain unsent drafts across navigation. */
    value?: string
    onValueChange?: (value: string) => void
    /** A review step keeps the question until the author explicitly sends it. */
    clearOnSubmit?: boolean
    submitLabel?: string
    submitIcon?: ReactNode
}

/**
 * Textarea + Send/Stop. Deliberately not a <form>: swapping Stop back to a
 * type=submit button mid-click fires a phantom submit under React 19's
 * synchronous discrete-event commits, so both buttons stay type="button".
 */
export function AssistantComposer({ streaming, disabled, placeholder, onSend, onStop, className, value, onValueChange, clearOnSubmit = true, submitLabel, submitIcon }: AssistantComposerProps) {
    const { t } = useTranslation()
    const [localInput, setLocalInput] = useState('')
    const input = value ?? localInput
    const setInput = (next: string) => { if (value === undefined) setLocalInput(next); onValueChange?.(next) }
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const resolvedPlaceholder = placeholder ?? t('creation.common.assistant.composerPlaceholder')

    const submit = () => {
        const text = input.trim()
        if (!text || streaming || disabled) return
        if (clearOnSubmit) setInput('')
        onSend(text)
        requestAnimationFrame(() => inputRef.current?.focus())
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
        }
    }

    const nearLimit = input.length >= MAX_LENGTH - 500

    return (
        <div className={cx('border-t border-parchment-50/[.08] bg-ink-700 p-3', className)}>
            <div className="flex items-end gap-2">
                <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    maxLength={MAX_LENGTH}
                    placeholder={resolvedPlaceholder}
                    aria-label={resolvedPlaceholder}
                    className="max-h-32 min-h-11 resize-none bg-ink-800 py-2.5 text-body"
                />
                {streaming ? (
                    <IconButton
                        onClick={onStop}
                        size="lg"
                        label={t('creation.common.assistant.stopResponse')}
                        className="border border-blood-500/40 bg-blood-500/10 text-blood-500 hover:bg-blood-500/25"
                    >
                        <Square size={16} strokeWidth={1.75} fill="currentColor" />
                    </IconButton>
                ) : (
                    <IconButton
                        onClick={submit}
                        size="lg"
                        disabled={disabled || !input.trim()}
                        label={submitLabel ?? t('creation.common.assistant.sendMessage')}
                        className="bg-ember-500 text-on-ember hover:bg-ember-400 hover:text-on-ember hover:shadow-glow-ember"
                    >
                        {submitIcon ?? <Send size={17} strokeWidth={1.75} />}
                    </IconButton>
                )}
            </div>
            {nearLimit && (
                <p className="mt-1.5 text-right font-mono text-caption text-parchment-400">
                    {input.length}/{MAX_LENGTH}
                </p>
            )}
        </div>
    )
}
