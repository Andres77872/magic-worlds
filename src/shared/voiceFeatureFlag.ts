import { isCallsFeatureEnabled } from './featureFlags'

export function isFrontendVoiceModeEnabled(): boolean {
    return isCallsFeatureEnabled()
}
