import { createContext } from 'react'
import type { ApiDependencyService } from '@/infrastructure/api'

export type ApiStatus = 'checking' | 'online' | 'offline'

export interface ApiStatusContextValue {
    status: ApiStatus
    services?: ApiDependencyService[]
    checkedAt?: string
    showServicesDownBanner?: boolean
}

export const ApiStatusContext = createContext<ApiStatusContextValue | undefined>(undefined)
