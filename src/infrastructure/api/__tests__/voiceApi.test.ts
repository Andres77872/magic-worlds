import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiService } from '../index'
import type { VoiceSegmentUploadRequest } from '@/shared/types/voice.types'

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        clone() {
            return jsonResponse(body, status)
        },
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response
}

function segmentBody(): VoiceSegmentUploadRequest {
    return {
        voice_session_id: 'voice-1',
        client_call_id: 'call-1',
        seq: 4,
        started_at_ms: 120,
        duration_ms: 640,
        encoding: 'audio/wav;codec=pcm_s16le',
        sample_rate: 16000,
        channels: 1,
        audio_sha256: 'a'.repeat(64),
        vad: { speech_ms: 600, silence_ms: 40, rms: 0.12, peak: 0.4, source: 'audio_worklet', aggressiveness: 'balanced' },
        audio: new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav;codec=pcm_s16le' }),
    }
}

describe('voice API helpers', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_FEATURE_CALLS_ENABLED', 'true')
        localStorage.clear()
        localStorage.setItem('magic_worlds:token', 'old-token')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('uploads voice segments as multipart without manual Content-Type and with idempotency', async () => {
        const fetchMock = vi.fn(async () => jsonResponse({
            voice_session_id: 'voice-1',
            segment_id: 'segment-1',
            seq: 4,
            status: 'accepted',
        }))
        vi.stubGlobal('fetch', fetchMock)
        const controller = new AbortController()

        const response = await apiService.uploadVoiceSegment(7, segmentBody(), { signal: controller.signal })

        expect(response.status).toBe('accepted')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(String(url)).toContain('/character-chats/7/voice-segments')
        expect(init.method).toBe('POST')
        expect(init.signal).toBe(controller.signal)
        expect(init.body).toBeInstanceOf(FormData)
        const headers = init.headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer old-token')
        expect(headers['Idempotency-Key']).toBe(`voice:voice-1:4:${'a'.repeat(64)}`)
        expect(headers['Content-Type']).toBeUndefined()
        const form = init.body as FormData
        expect(form.get('voice_session_id')).toBe('voice-1')
        expect(form.get('seq')).toBe('4')
        expect(form.get('vad_json')).toBe(JSON.stringify(segmentBody().vad))
        expect(form.get('audio')).toBeInstanceOf(Blob)
    })

    it('reuses refresh-once retry for voice segment uploads', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
            .mockResolvedValueOnce(jsonResponse({ access_token: 'new-token' }))
            .mockResolvedValueOnce(jsonResponse({ voice_session_id: 'voice-1', segment_id: 'segment-1', seq: 4, status: 'duplicate' }))
        vi.stubGlobal('fetch', fetchMock)

        const response = await apiService.uploadVoiceSegment(7, segmentBody())

        expect(response.status).toBe('duplicate')
        expect(fetchMock).toHaveBeenCalledTimes(3)
        const retryInit = fetchMock.mock.calls[2][1] as RequestInit
        expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer new-token')
    })

    it('saves consent and ends a voice call through the character-chat routes', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({
                status: 'accepted',
                consent_version: 'voice-v1',
                limits: { max_call_seconds: 600, idle_timeout_seconds: 30, remaining_daily_seconds: 120 },
            }))
            .mockResolvedValueOnce(jsonResponse({ status: 'ended', voice_session_id: 'voice-1', reason: 'navigation' }))
        vi.stubGlobal('fetch', fetchMock)

        const consent = await apiService.saveVoiceConsent(7)
        const ended = await apiService.endVoiceCall(7, { voiceSessionId: 'voice-1', reason: 'navigation' })

        expect(consent.consent_version).toBe('voice-v1')
        expect(ended.status).toBe('ended')
        expect(String(fetchMock.mock.calls[0][0])).toContain('/character-chats/7/voice-consent')
        expect(String(fetchMock.mock.calls[1][0])).toContain('/character-chats/7/voice-end')
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' })
        expect(fetchMock.mock.calls[1][1]?.body).toBe(JSON.stringify({ voice_session_id: 'voice-1', reason: 'navigation' }))
    })

    it('maps backend voice error categories from FastAPI detail frames', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
            detail: { type: 'voice_error', category: 'disabled', message: 'Voice call mode is disabled.', fatal: true },
        }, 503)))

        await expect(apiService.saveVoiceConsent(7)).rejects.toMatchObject({
            status: 503,
            category: 'disabled',
            message: 'Voice call mode is disabled.',
        })
    })
})
