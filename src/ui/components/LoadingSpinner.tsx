/**
 * Reusable loading spinner — Reverie candlelight.
 */
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface LoadingSpinnerProps {
    message?: string
    size?: 'small' | 'medium' | 'large'
}

const SIZE: Record<NonNullable<LoadingSpinnerProps['size']>, number> = {
    small: 18,
    medium: 28,
    large: 40,
}

export function LoadingSpinner({ message, size = 'medium' }: LoadingSpinnerProps) {
    const { t } = useTranslation()
    const displayMessage = message ?? t('loading.default')

    return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-parchment-200">
            <Loader2 size={SIZE[size]} strokeWidth={1.75} className="animate-spin text-ember-400" />
            {displayMessage && <p className="font-narrative text-body text-parchment-400">{displayMessage}</p>}
        </div>
    )
}
