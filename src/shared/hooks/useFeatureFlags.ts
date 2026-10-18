import { useSyncExternalStore } from 'react'
import { featureFlagRuntime } from '../featureFlagRuntime'

/** Subscribe only from consumers with an active rollout attachment. */
export function useFeatureFlags() {
    return useSyncExternalStore(featureFlagRuntime.subscribe, featureFlagRuntime.getSnapshot, featureFlagRuntime.getSnapshot)
}

