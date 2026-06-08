/**
 * AiGeneratePanel — the "Generate with AI" affordance shared by every creator.
 *
 * The backend AI endpoints generate AND persist the card, then return it, so on
 * success the creator typically reloads its data and navigates away. This panel
 * owns only the description input + busy/error state and delegates the actual
 * call to `onGenerate`, which must throw on failure so the error surfaces here.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AI_CARD_CLIENT_TIMEOUT_MS, AI_CARD_DESCRIPTION_MAX_CHARS, AI_CARD_DESCRIPTION_MIN_CHARS, type AiCardRequestOptions } from '@/shared'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { CreatorTextarea } from './CreatorField'

export type AiGenerateOptions = AiCardRequestOptions

export interface AiGeneratePanelProps {
    /** Lower-case card noun, e.g. "character" — used in copy and the button. */
    noun: string
    placeholder?: string
    onGenerate: (description: string, options: AiGenerateOptions) => Promise<void>
    timeoutMs?: number
}

function createClientId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function supportSuffix(requestId?: string): string {
    return requestId ? ` Support ID: ${requestId}` : ''
}

function aiErrorCopy(error: unknown, noun: string): string {
    const err = error as { message?: string; category?: string; code?: string; requestId?: string; retryAfterSeconds?: number }
    const suffix = supportSuffix(err.requestId)
    switch (err.category) {
        case 'description_invalid':
            return `${err.message || 'The description needs a little more work before AI can use it.'}${suffix}`
        case 'quota_exceeded':
            return `You've reached today's AI generation limit.${err.retryAfterSeconds ? ` Try again in about ${Math.ceil(err.retryAfterSeconds / 3600)} hour(s).` : ' Try again later.'}${suffix}`
        case 'generation_in_flight':
            return `Another AI generation is already running. Wait for it to finish before starting another.${suffix}`
        case 'generation_in_progress':
            return `That same generation request is already in progress. No second ${noun} was created.${suffix}`
        case 'idempotency_conflict':
            return `This retry no longer matches the original request. Start a new generation attempt.${suffix}`
        case 'timeout':
            return `Local waiting timed out. The backend may still finish and save the ${noun}; retrying this same prompt uses the same key to avoid duplicates.${suffix}`
        case 'upstream_unavailable':
            return `The AI service is temporarily unavailable. Try again in a moment or use a shorter description.${suffix}`
        case 'invalid_generated_output':
            return `The AI response could not become a valid ${noun}. Rephrase with clearer details and try again.${suffix}`
        case 'persistence_failed':
            return `The AI generated a ${noun}, but saving failed. Try again in a moment.${suffix}`
        case 'configuration_unavailable':
            return `AI generation is temporarily unavailable. Try again later.${suffix}`
        default:
            return err.message || `Failed to generate ${noun}. Please try again.`
    }
}

export function AiGeneratePanel({ noun, placeholder, onGenerate, timeoutMs = AI_CARD_CLIENT_TIMEOUT_MS }: AiGeneratePanelProps) {
    const [description, setDescription] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const controllerRef = useRef<AbortController | null>(null)
    const attemptRef = useRef<{ description: string; requestId: string; idempotencyKey: string } | null>(null)
    const mountedRef = useRef(true)

    const label = noun.charAt(0).toUpperCase() + noun.slice(1)
    const trimmed = description.trim()
    const trimmedLength = trimmed.length
    const isTooShort = trimmedLength > 0 && trimmedLength < AI_CARD_DESCRIPTION_MIN_CHARS
    const isTooLong = trimmedLength > AI_CARD_DESCRIPTION_MAX_CHARS
    const validationMessage = isTooLong
        ? `Keep it under ${AI_CARD_DESCRIPTION_MAX_CHARS} characters before generating.`
        : isTooShort
          ? `Write at least ${AI_CARD_DESCRIPTION_MIN_CHARS} characters so the AI has something useful.`
          : !trimmed
            ? `Write at least ${AI_CARD_DESCRIPTION_MIN_CHARS} characters to generate a ${noun}.`
            : null
    const canGenerate = Boolean(trimmed) && !isTooShort && !isTooLong && !isGenerating

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            controllerRef.current?.abort()
        }
    }, [])

    const attemptFor = (prompt: string) => {
        if (attemptRef.current?.description === prompt) return attemptRef.current
        const next = {
            description: prompt,
            requestId: createClientId('mw-ai-card-req'),
            idempotencyKey: createClientId('mw-ai-card-idem'),
        }
        attemptRef.current = next
        return next
    }

    const handleCancel = () => {
        controllerRef.current?.abort()
    }

    const handleGenerate = async () => {
        const prompt = trimmed
        if (!canGenerate) {
            setError(validationMessage)
            return
        }
        const attempt = attemptFor(prompt)
        const controller = new AbortController()
        controllerRef.current = controller
        setIsGenerating(true)
        setError(null)
        try {
            await onGenerate(prompt, {
                signal: controller.signal,
                requestId: attempt.requestId,
                idempotencyKey: attempt.idempotencyKey,
                timeoutMs,
            })
            // On success the creator reloads and navigates away — nothing to do.
        } catch (err) {
            if (!mountedRef.current) return
            if (controller.signal.aborted && !(err as { category?: string })?.category) {
                setError(`Canceled locally. The backend may still finish and save the ${noun}; retrying this same prompt uses the same key to avoid duplicates.`)
            } else {
                setError(aiErrorCopy(err, noun))
            }
        } finally {
            if (mountedRef.current) {
                setIsGenerating(false)
                controllerRef.current = null
            }
        }
    }

    return (
        <div className="flex flex-col gap-4 rounded-md border border-arcane-500/30 bg-arcane-500/[.06] p-6">
            <SectionHeader icon={Sparkles} tone="arcane" title="Generate with AI" />
            <p className="font-narrative text-sm text-parchment-400">
                Describe the {noun} you have in mind and let the AI draft it — you can refine it afterwards.
            </p>
            <CreatorTextarea
                id={`ai-generate-${noun}`}
                value={description}
                onChange={setDescription}
                placeholder={placeholder ?? `Describe the ${noun}…`}
                rows={3}
                maxLength={AI_CARD_DESCRIPTION_MAX_CHARS + 1}
            />
            <div className="flex items-center justify-between gap-3 text-xs text-parchment-400">
                <span>{validationMessage}</span>
                <span className={isTooLong ? 'text-blood-500' : undefined}>{trimmedLength}/{AI_CARD_DESCRIPTION_MAX_CHARS}</span>
            </div>
            {isGenerating && (
                <p className="font-narrative text-xs italic text-parchment-400">
                    You can cancel local waiting, but the backend may still finish and save the {noun}. Retry uses the same key to avoid duplicates.
                </p>
            )}
            {error && <p className="text-sm text-blood-500">{error}</p>}
            <div className="flex justify-end gap-2">
                {isGenerating && (
                    <Button kind="secondary" onClick={handleCancel}>
                        Cancel
                    </Button>
                )}
                <Button
                    kind="arcane"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    iconLeft={<Icon icon={Sparkles} size={16} />}
                >
                    {isGenerating ? 'Generating…' : `Generate ${label}`}
                </Button>
            </div>
        </div>
    )
}
