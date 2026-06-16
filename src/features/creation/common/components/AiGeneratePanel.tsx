/**
 * AiGeneratePanel — the "Generate with AI" affordance shared by every creator.
 *
 * The backend AI endpoints generate AND persist the card, then return it, so on
 * success the creator typically reloads its data and navigates away. This panel
 * owns only the description input + busy/error state and delegates the actual
 * call to `onGenerate`, which must throw on failure so the error surfaces here.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Sparkles } from 'lucide-react'
import { AI_CARD_CLIENT_TIMEOUT_MS, AI_CARD_DESCRIPTION_MAX_CHARS, AI_CARD_DESCRIPTION_MIN_CHARS, type AiCardRequestOptions } from '@/shared'
import { Button, Icon, SectionHeader } from '@/ui/primitives'
import { makeRequestId } from '@/utils/uuid'
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
    return makeRequestId(prefix)
}

function supportSuffix(t: TFunction, requestId?: string): string {
    return requestId ? t('creation.common.aiGenerate.errors.supportId', { requestId }) : ''
}

function quotaRetry(t: TFunction, retryAfterSeconds?: number): string {
    return retryAfterSeconds
        ? t('creation.common.aiGenerate.errors.quotaRetryHours', { count: Math.ceil(retryAfterSeconds / 3600) })
        : t('creation.common.aiGenerate.errors.quotaRetryLater')
}

function aiErrorCopy(error: unknown, noun: string, t: TFunction): string {
    const err = error as { message?: string; category?: string; code?: string; requestId?: string; retryAfterSeconds?: number }
    const suffix = supportSuffix(t, err.requestId)
    switch (err.category) {
        case 'description_invalid':
            return `${err.message || t('creation.common.aiGenerate.errors.descriptionInvalid')}${suffix}`
        case 'quota_exceeded':
            return `${t('creation.common.aiGenerate.errors.quotaExceeded')}${quotaRetry(t, err.retryAfterSeconds)}${suffix}`
        case 'generation_in_flight':
            return `${t('creation.common.aiGenerate.errors.inFlight')}${suffix}`
        case 'generation_in_progress':
            return `${t('creation.common.aiGenerate.errors.inProgress', { noun })}${suffix}`
        case 'idempotency_conflict':
            return `${t('creation.common.aiGenerate.errors.idempotencyConflict')}${suffix}`
        case 'timeout':
            return `${t('creation.common.aiGenerate.errors.timeout', { noun })}${suffix}`
        case 'upstream_unavailable':
            return `${t('creation.common.aiGenerate.errors.upstreamUnavailable')}${suffix}`
        case 'invalid_generated_output':
            return `${t('creation.common.aiGenerate.errors.invalidOutput', { noun })}${suffix}`
        case 'persistence_failed':
            return `${t('creation.common.aiGenerate.errors.persistenceFailed', { noun })}${suffix}`
        case 'configuration_unavailable':
            return `${t('creation.common.aiGenerate.errors.configurationUnavailable')}${suffix}`
        default:
            return err.message || t('creation.common.aiGenerate.errors.generic', { noun })
    }
}

export function AiGeneratePanel({ noun, placeholder, onGenerate, timeoutMs = AI_CARD_CLIENT_TIMEOUT_MS }: AiGeneratePanelProps) {
    const { t } = useTranslation()
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
        ? t('creation.common.aiGenerate.validation.tooLong', { max: AI_CARD_DESCRIPTION_MAX_CHARS })
        : isTooShort
          ? t('creation.common.aiGenerate.validation.tooShort', { min: AI_CARD_DESCRIPTION_MIN_CHARS })
          : !trimmed
            ? t('creation.common.aiGenerate.validation.empty', { min: AI_CARD_DESCRIPTION_MIN_CHARS, noun })
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
                setError(t('creation.common.aiGenerate.canceledLocally', { noun }))
            } else {
                setError(aiErrorCopy(err, noun, t))
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
            <SectionHeader icon={Sparkles} tone="arcane" title={t('creation.common.aiGenerate.title')} />
            <p className="font-narrative text-sm text-parchment-400">
                {t('creation.common.aiGenerate.prompt', { noun })}
            </p>
            <CreatorTextarea
                id={`ai-generate-${noun}`}
                value={description}
                onChange={setDescription}
                placeholder={placeholder ?? t('creation.common.aiGenerate.placeholder', { noun })}
                rows={3}
                maxLength={AI_CARD_DESCRIPTION_MAX_CHARS + 1}
            />
            <div className="flex items-center justify-between gap-3 text-xs text-parchment-400">
                <span>{validationMessage}</span>
                <span className={isTooLong ? 'text-blood-500' : undefined}>{trimmedLength}/{AI_CARD_DESCRIPTION_MAX_CHARS}</span>
            </div>
            {isGenerating && (
                <p className="font-narrative text-xs italic text-parchment-400">
                    {t('creation.common.aiGenerate.busyNote', { noun })}
                </p>
            )}
            {error && <p className="text-sm text-blood-500">{error}</p>}
            <div className="flex justify-end gap-2">
                {isGenerating && (
                    <Button variant="secondary" onClick={handleCancel}>
                        {t('common.cancel')}
                    </Button>
                )}
                <Button
                    variant="arcane"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    iconLeft={<Icon icon={Sparkles} size={16} />}
                >
                    {isGenerating ? t('creation.common.aiGenerate.generating') : t('creation.common.aiGenerate.generate', { label })}
                </Button>
            </div>
        </div>
    )
}
