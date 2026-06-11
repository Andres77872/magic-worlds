import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiService } from '@/infrastructure/api'
import { ApiStatusContext, type ApiStatus } from './apiStatusContext'

export const API_STATUS_POLL_INTERVAL_MS = 10_000
export const API_STATUS_TIMEOUT_MS = 3_000

interface ApiStatusProviderProps {
    children: ReactNode
    pollIntervalMs?: number
    timeoutMs?: number
}

export function ApiStatusProvider({
    children,
    pollIntervalMs = API_STATUS_POLL_INTERVAL_MS,
    timeoutMs = API_STATUS_TIMEOUT_MS,
}: ApiStatusProviderProps) {
    const [status, setStatus] = useState<ApiStatus>('checking')

    useEffect(() => {
        let isMounted = true
        let isInFlight = false
        let controller: AbortController | null = null

        const check = async () => {
            if (isInFlight) return
            isInFlight = true
            controller = new AbortController()
            const timeoutId = window.setTimeout(() => controller?.abort(), timeoutMs)

            try {
                const health = await apiService.getHealth({ signal: controller.signal })
                if (isMounted) {
                    setStatus(health.status === 'ok' ? 'online' : 'offline')
                }
            } catch {
                if (isMounted) {
                    setStatus('offline')
                }
            } finally {
                window.clearTimeout(timeoutId)
                isInFlight = false
                controller = null
            }
        }

        void check()
        const intervalId = window.setInterval(() => void check(), pollIntervalMs)

        return () => {
            isMounted = false
            controller?.abort()
            window.clearInterval(intervalId)
        }
    }, [pollIntervalMs, timeoutMs])

    const value = useMemo(() => ({ status }), [status])

    return <ApiStatusContext.Provider value={value}>{children}</ApiStatusContext.Provider>
}
