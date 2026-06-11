import { useContext } from 'react'
import { ApiStatusContext } from '../providers/apiStatusContext'

export type { ApiStatus } from '../providers/apiStatusContext'
export { API_STATUS_POLL_INTERVAL_MS, API_STATUS_TIMEOUT_MS } from '../providers/ApiStatusProvider'

export function useApiStatus() {
    const context = useContext(ApiStatusContext)
    if (context === undefined) {
        throw new Error('useApiStatus must be used within an ApiStatusProvider')
    }
    return context
}
