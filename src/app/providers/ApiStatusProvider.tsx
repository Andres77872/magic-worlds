import { useEffect, useState, type ReactNode } from 'react'
import { apiService } from '@/infrastructure/api'
import { ApiStatusContext, type ApiStatus, type ApiStatusContextValue } from './apiStatusContext'

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
    const [value, setValue] = useState<ApiStatusContextValue>({ status: 'checking', services: [] })

    useEffect(() => {
        let isMounted = true
        let isInFlight = false
        let controller: AbortController | null = null
        const toApiStatus = (status: string): ApiStatus => status === 'ok' ? 'online' : 'offline'

        const check = async () => {
            if (isInFlight) return
            isInFlight = true
            controller = new AbortController()
            const timeoutId = window.setTimeout(() => controller?.abort(), timeoutMs)

            try {
                const health = await apiService.getDependencyHealth({ signal: controller.signal })
                if (isMounted) {
                    setValue({
                        status: toApiStatus(health.status),
                        services: health.services ?? [],
                        checkedAt: health.checked_at,
                    })
                }
            } catch {
                if (!controller.signal.aborted) {
                    try {
                        const health = await apiService.getHealth({ signal: controller.signal })
                        if (isMounted) {
                            setValue({
                                status: toApiStatus(health.status),
                                services: [],
                                checkedAt: undefined,
                            })
                        }
                    } catch {
                        if (isMounted) {
                            setValue({ status: 'offline', services: [], checkedAt: undefined })
                        }
                    }
                } else if (isMounted) {
                    setValue({ status: 'offline', services: [], checkedAt: undefined })
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

    return <ApiStatusContext.Provider value={value}>{children}</ApiStatusContext.Provider>
}
