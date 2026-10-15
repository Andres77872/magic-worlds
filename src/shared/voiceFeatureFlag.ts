import { isCallsFeatureEnabled } from './featureFlags'

/** Legacy call-mode name; effective availability includes the parent voices flag. */
export function isFrontendVoiceModeEnabled(): boolean {
    return isCallsFeatureEnabled()
}
