import { useTranslation } from 'react-i18next'
import { CircleAlert, CircleStop, Loader2, RotateCcw } from 'lucide-react'
import { Button, cx } from '../../../ui/primitives'

interface UnsavedReplyNoticeProps {
    /** `stopped` when the player cancelled it; `failed` for every other ending. */
    reason: 'stopped' | 'failed'
    /** Who was replying ("Game Master" or the character). */
    aiLabel: string
    /** A more specific explanation from the failed request, when there is one. */
    detail?: string | null
    /** Hidden while a retry can't start (a request is running or being checked). */
    onRetry?: () => void
    retrying?: boolean
}

/**
 * Stands in for a reply that never became part of the conversation. Failed and
 * stopped replies are stored empty and never reach the model, so they are not
 * shown as messages: the reader gets this notice and a retry that replaces it.
 */
export function UnsavedReplyNotice({ reason, aiLabel, detail, onRetry, retrying = false }: UnsavedReplyNoticeProps) {
    const { t } = useTranslation()
    const stopped = reason === 'stopped'
    const Glyph = stopped ? CircleStop : CircleAlert
    return (
        <div
            role="status"
            data-testid="unsaved-reply"
            className="mb-8 ml-12 flex max-w-[640px] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-parchment-50/10 bg-ink-700/60 px-4 py-3"
        >
            <Glyph
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className={cx('shrink-0', stopped ? 'text-parchment-400' : 'text-blood-500')}
            />
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
                <span className="text-label font-semibold text-parchment-100">
                    {stopped ? t('interaction.center.replyStopped') : t('interaction.center.replyFailed', { name: aiLabel })}
                </span>
                <span className="text-caption text-parchment-400">
                    {detail || t('interaction.center.replyNotSaved')}
                </span>
            </div>
            {onRetry && (
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={retrying}
                    iconLeft={retrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} strokeWidth={1.75} />}
                    onClick={onRetry}
                >
                    {t('interaction.center.tryAgain')}
                </Button>
            )}
        </div>
    )
}
