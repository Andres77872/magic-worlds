import { createContext } from 'react'

export type ApiStatus = 'checking' | 'online' | 'offline'

export interface ApiStatusContextValue {
    status: ApiStatus
}

export const ApiStatusContext = createContext<ApiStatusContextValue | undefined>(undefined)
