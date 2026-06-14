import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Square } from 'lucide-react'
import { controlClass, cx } from '@/ui/primitives'

const MAX_LENGTH = 4000

interface AssistantComposerProps {
    streaming: boolean
    disabled?: boolean
    placeholder?: string
    onSend: (text: string) => void
    onStop: () => void
}

/**
 * Textarea + Send/Stop. Deliberately not a <form>: swapping Stop back to a
 * type=submit button mid-click fires a phantom submit under React 19's
 * synchronous discrete-event commits, so both buttons stay type="button".
 */
export function AssistantComposer({ streaming, disabled, placeholder, onSend, onStop }: AssistantComposerProps) {
    const { t } = useTranslation()
    const [input, setInput] = useState('')
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const resolvedPlaceholder = placeholder ?? t('creation.common.assistant.composerPlaceholder')

    const submit = () => {
        const text = input.trim()
        if (!text || streaming || disabled) return
        setInput('')
        onSend(text)
        requestAnimationFrame(() => inputRef.current?.focus())
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
        }
    }

    const nearLimit = input.length >= MAX_LENGTH - 500

    return (
        <div className="border-t border-parchment-50/[.08] bg-ink-700 p-3">
            <div className="flex items-end gap-2">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    maxLength={MAX_LENGTH}
                    placeholder={resolvedPlaceholder}
                    aria-label={resolvedPlaceholder}
                    className={cx(controlClass, 'max-h-32 min-h-[44px] resize-none bg-ink-800 py-2.5 text-[14px]')}
                />
                {streaming ? (
                    <button
                        type="button"
                        onClick={onStop}
                        aria-label={t('creation.common.assistant.stopResponse')}
                        title={t('creation.common.assistant.stopResponse')}
                        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md border border-blood-500/40 bg-blood-500/10 text-blood-500 transition-colors hover:bg-blood-500/25"
                    >
                        <Square size={16} fill="currentColor" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={disabled || !input.trim()}
                        aria-label={t('creation.common.assistant.sendMessage')}
                        title={t('creation.common.assistant.sendMessage')}
                        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md bg-ember-500 text-on-ember transition-all hover:bg-ember-400 hover:shadow-glow-ember active:scale-[.98] disabled:pointer-events-none disabled:opacity-50"
                    >
                        <Send size={17} />
                    </button>
                )}
            </div>
            {nearLimit && (
                <p className="mt-1.5 text-right font-mono text-[11px] text-parchment-400">
                    {input.length}/{MAX_LENGTH}
                </p>
            )}
        </div>
    )
}
