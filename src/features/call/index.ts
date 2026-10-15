/**
 * Character voice-call discovery, launch, and history surfaces.
 * (The in-call runtime lives in features/interaction.)
 */

export { CallsPage } from './components/CallsPage'
export { CallScreen, CallScreenView, type CallScreenViewProps } from './components/CallScreen'
export { CallTranscriptView } from './components/CallTranscriptView'
export { CallHistoryRow } from './components/CallHistoryRow'
export { CallStartErrorToast } from './components/CallStartErrorToast'
export { useStartCall, type UseStartCall } from './useStartCall'
// Workspace R1: the switch coordinator ends a live call (and awaits its quota release) before committing.
export {
    endActiveVoiceCall,
    hasActiveVoiceCall,
    activeVoiceCallWorkspaceId,
    useHasActiveVoiceCall,
    type ActiveVoiceCall,
} from './activeVoiceCall'
export * from './callTransforms'
