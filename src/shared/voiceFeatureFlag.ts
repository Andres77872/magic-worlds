export function isFrontendVoiceModeEnabled(): boolean {
    return import.meta.env.VITE_VOICE_MODE_ENABLED === 'true'
}
