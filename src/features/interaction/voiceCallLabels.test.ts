import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import { callErrorCopy, endReasonCopy, isSetupCallError, isTerminalVoiceCallError, isWorkspaceCallError } from './voiceCallLabels'

const t = i18n.getFixedT('en')

describe('voiceCallLabels (Workspace R1)', () => {
    it('explains an active call that blocks archiving and a chat missing from the workspace', () => {
        expect(callErrorCopy(t, { category: 'conflict', code: 'WORKSPACE_ACTIVE_CALL', message: 'raw', fatal: true }))
            .toBe('End the active call in this workspace before archiving it.')
        expect(callErrorCopy(t, { category: 'not_found', code: 'CHAT_SESSION_NOT_FOUND', message: 'raw', fatal: true }))
            .toBe('This conversation is not available in this workspace.')
    })

    it('treats workspace codes and the missing chat as errors no redial can fix', () => {
        expect(isWorkspaceCallError('WORKSPACE_ARCHIVED')).toBe(true)
        expect(isWorkspaceCallError('WORKSPACE_REQUIRED')).toBe(true)
        expect(isWorkspaceCallError('CHAT_SESSION_NOT_FOUND')).toBe(true)
        expect(isWorkspaceCallError('VOICE_CONNECTION_LOST')).toBe(false)
        expect(isWorkspaceCallError(undefined)).toBe(false)
    })
})

describe('voiceCallLabels (voice error codes, 09 §4.6)', () => {
    const es = i18n.getFixedT('es')

    it('gives voice_unavailable and moderation_unavailable their own copy instead of the category fallback', () => {
        const fallback = callErrorCopy(t, { category: 'tts_unavailable', message: 'raw', fatal: false })
        const unavailable = callErrorCopy(t, { category: 'tts_unavailable', code: 'voice_unavailable', message: 'raw', fatal: false })
        const moderation = callErrorCopy(t, { category: 'tts_unavailable', code: 'moderation_unavailable', message: 'raw', fatal: false })

        expect(unavailable).toBe('This voice can’t take calls right now. Choose another voice in call settings and call again.')
        expect(moderation).toBe('Voice is briefly unavailable. Try again in a moment.')
        expect(unavailable).not.toBe(fallback)
        expect(moderation).not.toBe(fallback)
    })

    it('localizes both codes in Spanish', () => {
        expect(callErrorCopy(es, { category: 'tts_unavailable', code: 'voice_unavailable', message: 'raw', fatal: false }))
            .toBe('Esta voz no puede usarse en llamadas ahora mismo. Elige otra voz en los ajustes de la llamada y vuelve a llamar.')
        expect(callErrorCopy(es, { category: 'tts_unavailable', code: 'moderation_unavailable', message: 'raw', fatal: false }))
            .toBe('La voz no está disponible por un momento. Inténtalo de nuevo en un momento.')
    })
})

describe('voiceCallLabels (call setup refusals)', () => {
    it('sends an unusable voice or a missing conversation model to the call settings', () => {
        expect(callErrorCopy(t, { category: 'provider_submission', code: 'call_model_unavailable', message: 'raw', fatal: true }))
            .toBe('No conversation model is set up for calls yet. An admin can choose one in call settings.')
        expect(isSetupCallError('call_model_unavailable')).toBe(true)
        expect(isSetupCallError('voice_unavailable')).toBe(true)
        expect(isSetupCallError('provider_unavailable')).toBe(false)
        expect(isSetupCallError(undefined)).toBe(false)
    })
})

describe('voiceCallLabels (R2 safeguards: safety pause, region block)', () => {
    const es = i18n.getFixedT('es')

    it('labels the safety pause and the region block, never as a provider failure', () => {
        const fallback = callErrorCopy(t, { category: 'tts_unavailable', message: 'raw', fatal: true })
        const pause = callErrorCopy(t, { category: 'tts_unavailable', code: 'voice_safety_pause', message: 'raw', fatal: true })
        const region = callErrorCopy(t, { category: 'disabled', code: 'voice_region_unavailable', message: 'raw', fatal: true })

        expect(pause).toBe('Voice is paused for now.')
        expect(region).toBe('Voice is not available in your region.')
        expect(pause).not.toBe(fallback)
        expect(callErrorCopy(es, { category: 'tts_unavailable', code: 'voice_safety_pause', message: 'raw', fatal: true })).toBe('La voz está en pausa por ahora.')
        expect(callErrorCopy(es, { category: 'disabled', code: 'voice_region_unavailable', message: 'raw', fatal: true })).toBe('La voz no está disponible en tu región.')
    })

    it('marks both as terminal: no redial fixes them', () => {
        expect(isTerminalVoiceCallError('voice_safety_pause')).toBe(true)
        expect(isTerminalVoiceCallError('voice_region_unavailable')).toBe(true)
        expect(isTerminalVoiceCallError('voice_unavailable')).toBe(false)
        expect(isTerminalVoiceCallError('VOICE_CONNECTION_LOST')).toBe(false)
        expect(isTerminalVoiceCallError(null)).toBe(false)
        expect(isWorkspaceCallError('voice_safety_pause')).toBe(false)
    })

    it('explains a voice_restricted end reason', () => {
        expect(endReasonCopy(t, 'voice_restricted')).toBe('Voice isn’t available for your account right now, so the call ended.')
        expect(endReasonCopy(es, 'voice_restricted')).toBe('La voz no está disponible para tu cuenta ahora mismo, así que la llamada terminó.')
    })
})
