import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'

export function LandingLoading() {
    const { t } = useTranslation()
    return (
        <div
            className="flex min-h-screen flex-col items-center justify-center bg-ink-800"
            role="status"
            aria-live="polite"
        >
            <LoadingSpinner size="large" message={t('landing.loading')} />
        </div>
    )
}
