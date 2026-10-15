import type { UserNotification } from '@/shared/types'
import { isContentTypeFeatureEnabled, isOperationFeatureEnabled } from '@/shared/featureFlags'
import { isAppLinkFeatureEnabled } from '@/app/router/linkAvailability'

/** Account history stays readable; disabled product destinations offer no action. */
export function notificationActionAvailable(item: UserNotification): boolean {
    for (const key of ['job_kind', 'operation']) {
        const operation = item.metadata?.[key]
        if (typeof operation === 'string' && !isOperationFeatureEnabled(operation)) return false
    }
    for (const key of ['card_type', 'target_type']) {
        const type = item.metadata?.[key]
        if (typeof type === 'string' && !isContentTypeFeatureEnabled(type)) return false
    }
    return isAppLinkFeatureEnabled(item.action_url)
}
