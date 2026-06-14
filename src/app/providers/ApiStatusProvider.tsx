import { useEffect, useState, type ReactNode } from 'react'
import { apiService } from '@/infrastructure/api'
import { ApiStatusContext, type ApiStatus, type ApiStatusContextValue } from './apiStatusContext'

export const API_STATUS_POLL_INTERVAL_MS = 60_000
export const API_STATUS_TIMEOUT_MS = 3_000
export const API_STATUS_BANNER_OFFLINE_THRESHOLD = 2

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
    const [value, setValue] = useState<ApiStatusContextValue>({
        status: 'checking',
        services: [],
        showServicesDownBanner: false,
    })

    useEffect(() => {
        let isMounted = true
        let isInFlight = false
        let controller: AbortController | null = null
        let offlineChecks = 0
        const toApiStatus = (status: string): ApiStatus => status === 'ok' ? 'online' : 'offline'

        const updateStatus = (nextValue: Omit<ApiStatusContextValue, 'showServicesDownBanner'>) => {
            if (nextValue.status === 'offline') {
                offlineChecks += 1
            } else {
                offlineChecks = 0
            }

            setValue({
                ...nextValue,
                showServicesDownBanner: offlineChecks >= API_STATUS_BANNER_OFFLINE_THRESHOLD,
            })
        }

        const check = async () => {
            if (isInFlight) return
            isInFlight = true
            controller = new AbortController()
            const timeoutId = window.setTimeout(() => controller?.abort(), timeoutMs)

            try {
                const health = await apiService.getDependencyHealth({ signal: controller.signal })
                if (isMounted) {
                    updateStatus({
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
                            updateStatus({
                                status: toApiStatus(health.status),
                                services: [],
                                checkedAt: undefined,
                            })
                        }
                    } catch {
                        if (isMounted) {
                            updateStatus({ status: 'offline', services: [], checkedAt: undefined })
                        }
                    }
                } else if (isMounted) {
                    updateStatus({ status: 'offline', services: [], checkedAt: undefined })
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
