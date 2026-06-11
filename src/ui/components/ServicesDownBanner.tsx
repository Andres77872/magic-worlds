import { AlertTriangle } from 'lucide-react'
import { useApiStatus } from '@/app/hooks'
import { Icon } from '../primitives'

export function ServicesDownBanner() {
    const { status } = useApiStatus()

    if (status !== 'offline') return null

    return (
        <div
            role="alert"
            aria-live="assertive"
            className="flex shrink-0 items-center gap-3 border-b border-blood-500/25 bg-blood-500/10 px-4 py-3 text-sm font-medium text-parchment-100"
        >
            <Icon icon={AlertTriangle} size={18} className="shrink-0 text-blood-500" />
            <span>Services are down. Some actions may fail until the API is back online.</span>
        </div>
    )
}
