/**
 * Non-blocking strip under the top chrome when the library data load partially
 * or fully failed — without it a backend outage renders as convincing empty
 * states with no way to retry. Retries silently so the mounted page (and any
 * in-progress editor state) survives.
 */
import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useData } from '@/app/hooks'
import { Button, Icon, IconButton } from '@/ui/primitives'

export function DataLoadErrorBanner() {
    const { t } = useTranslation()
    const { loadingState, loadData } = useData()
    const [dismissed, setDismissed] = useState(false)
    const [retrying, setRetrying] = useState(false)
    const error = loadingState.error

    // A new failure re-surfaces the banner after a dismissal.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(false)
    }, [error])

    if (!error || loadingState.isLoading || dismissed) return null

    const handleRetry = async () => {
        setRetrying(true)
        try {
            // Silent: refreshes in place without unmounting the current page.
            await loadData({ silent: true })
        } finally {
            setRetrying(false)
        }
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-parchment-100"
        >
            <span className="flex min-w-0 items-center gap-3">
                <Icon icon={CloudOff} size={18} className="shrink-0 text-amber-500" />
                <span className="truncate">{t('dataLoadBanner.message')}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
                <Button
                    variant="primary"
                    size="sm"
                    iconLeft={<RefreshCw size={15} strokeWidth={1.75} />}
                    onClick={() => void handleRetry()}
                    disabled={retrying}
                >
                    {retrying ? t('dataLoadBanner.retrying') : t('dataLoadBanner.retry')}
                </Button>
                <IconButton label={t('dataLoadBanner.dismiss')} size="sm" onClick={() => setDismissed(true)}>
                    <X size={14} />
                </IconButton>
            </span>
        </div>
    )
}
