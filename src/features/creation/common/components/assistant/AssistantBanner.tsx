import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, X } from 'lucide-react'
import { Button, cx, IconButton } from '@/ui/primitives'
import type { AssistantNotice } from './useCardAssistant'

interface AssistantBannerProps {
    notice: AssistantNotice
    onRetry: () => void
    onReload: () => void
    onDismiss: () => void
}

/** Error/info strip above the composer with Retry / Check-conversation actions. */
export function AssistantBanner({ notice, onRetry, onReload, onDismiss }: AssistantBannerProps) {
    const { t } = useTranslation()
    const isError = notice.kind === 'error'
    return (
        <div
            role={isError ? 'alert' : 'status'}
            className={cx(
                'flex items-start gap-2 border-t px-3.5 py-2',
                isError ? 'border-blood-500/30 bg-blood-500/10' : 'border-amber-500/30 bg-amber-500/10',
            )}
        >
            {isError
                ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-blood-500" />
                : <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />}
            <p className="min-w-0 flex-1 font-ui text-[12px] leading-relaxed text-parchment-100">{notice.message}</p>
            <div className="flex shrink-0 items-center gap-1">
                {notice.canRetry && (
                    <Button kind="ghost" size="sm" className="px-2 py-1 text-ember-300" onClick={onRetry}>
                        {t('creation.common.assistant.retry')}
                    </Button>
                )}
                {notice.canReload && (
                    <Button kind="ghost" size="sm" className="px-2 py-1 text-ember-300" onClick={onReload}>
                        {t('creation.common.assistant.checkConversation')}
                    </Button>
                )}
                <IconButton label={t('creation.common.assistant.dismissNotice')} size="sm" className="h-6 w-6" onClick={onDismiss}>
                    <X size={13} />
                </IconButton>
            </div>
        </div>
    )
}
