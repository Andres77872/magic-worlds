import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppVersionCheck } from '@/app/hooks'
import { Button, Icon } from '@/ui/primitives'
import { offlineAppControlled, prepareOfflineApp, subscribeOfflineAppControl, type OfflineAppState } from '@/app/offline/offlineApp'

interface AppUpdateBannerProps {
    updateAvailable?: boolean
    onReload?: () => void
    offlineControlled?: boolean
}

export function AppUpdateBanner({ updateAvailable, onReload, offlineControlled }: AppUpdateBannerProps) {
    const { t } = useTranslation()
    const versionCheck = useAppVersionCheck()
    const isVisible = updateAvailable ?? versionCheck.updateAvailable
    const pinned = useSyncExternalStore(subscribeOfflineAppControl, () => offlineControlled ?? offlineAppControlled(), () => false)
    const [offline, setOffline] = useState<OfflineAppState | null>(null), [busy, setBusy] = useState(false)
    const alive = useRef(true)
    const downloading = useRef(false)
    useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

    if (!isVisible) return null

    const handleReload = onReload ?? (() => window.location.reload())
    const download = async () => {
        if (downloading.current) return
        downloading.current = true
        setBusy(true)
        const result = await prepareOfflineApp()
        downloading.current = false
        if (alive.current) { setOffline(result); setBusy(false) }
    }
    const offlineText = offline?.state === 'waiting' ? 'waiting' : offline?.state === 'ready' ? 'ready'
        : offline?.state === 'failed' ? 'failed_' + offline.reason : 'update'

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex shrink-0 flex-col gap-3 border-b border-ember-500/25 bg-ember-500/10 px-4 py-3 text-sm font-medium text-parchment-100 sm:flex-row sm:items-center sm:justify-between"
        >
            <span className="flex min-w-0 items-center gap-3">
                <Icon icon={RefreshCw} size={18} className="shrink-0 text-ember-400" />
                <span>{t(pinned ? 'novelEditor.offlineApp.' + offlineText : 'appUpdate.message')}</span>
            </span>
            <Button
                variant="primary"
                size="sm"
                className="self-start sm:self-auto"
                iconLeft={<RefreshCw size={15} strokeWidth={1.75} />}
                aria-disabled={busy || undefined}
                aria-busy={busy}
                onClick={pinned ? () => void download() : handleReload}
            >
                {t(pinned ? 'novelEditor.offlineApp.' + (busy ? 'preparing' : 'updatePrepare') : 'appUpdate.reload')}
            </Button>
        </div>
    )
}
