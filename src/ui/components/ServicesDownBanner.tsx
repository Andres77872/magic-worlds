import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApiStatus } from '@/app/hooks'
import { Icon } from '../primitives'

export function ServicesDownBanner() {
    const { t } = useTranslation()
    const { showServicesDownBanner } = useApiStatus()

    if (!showServicesDownBanner) return null

    return (
        <div
            role="alert"
            aria-live="assertive"
            className="flex shrink-0 items-center gap-3 border-b border-blood-500/25 bg-blood-500/10 px-4 py-3 text-sm font-medium text-parchment-100"
        >
            <Icon icon={AlertTriangle} size={18} className="shrink-0 text-blood-500" />
            <span>{t('servicesDown.message')}</span>
        </div>
    )
}
