import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppVersionCheck } from '@/app/hooks'
import { Button, Icon } from '@/ui/primitives'

interface AppUpdateBannerProps {
    updateAvailable?: boolean
    onReload?: () => void
}

export function AppUpdateBanner({ updateAvailable, onReload }: AppUpdateBannerProps) {
    const { t } = useTranslation()
    const versionCheck = useAppVersionCheck()
    const isVisible = updateAvailable ?? versionCheck.updateAvailable

    if (!isVisible) return null

    const handleReload = onReload ?? (() => window.location.reload())

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex shrink-0 flex-col gap-3 border-b border-ember-500/25 bg-ember-500/10 px-4 py-3 text-sm font-medium text-parchment-100 sm:flex-row sm:items-center sm:justify-between"
        >
            <span className="flex min-w-0 items-center gap-3">
                <Icon icon={RefreshCw} size={18} className="shrink-0 text-ember-400" />
                <span>{t('appUpdate.message')}</span>
            </span>
            <Button
                variant="primary"
                size="sm"
                className="self-start sm:self-auto"
                iconLeft={<RefreshCw size={15} strokeWidth={1.75} />}
                onClick={handleReload}
            >
                {t('appUpdate.reload')}
            </Button>
        </div>
    )
}
