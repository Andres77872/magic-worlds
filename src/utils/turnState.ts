/**
 * Normalises the turn list out of an adventure session's `adventure_last_turn`
 * JSON string. The magic-worlds-api returns this field in several shapes:
 *
 *  - canonical projection (GET /adventure-sessions/{id}):
 *        { messages, turns, version, source: "canonical_projection" }
 *  - wrapped legacy cache (after a PUT, returned by GET /adventure-sessions/):
 *        { source: "legacy_cache", legacy: { turns: [...] } }
 *  - the client's own legacy write (older sessions):  { turns: [...] }
 *  - empty / uninitialised:  "{}"  |  ""  |  null
 *
 * All of them normalise to a TurnEntry[]. Returning [] on anything unexpected
 * keeps callers from crashing on a malformed or wrapped payload.
 */

import type { ChatImageAsset, ChatImageError, ChatTtsAsset, ChatTtsError, ChatTtsSegmentClip, ImageLifecycleStatus, TtsLifecycleStatus, TurnEntry } from '@/shared'
import { safeResponseSegments } from '@/utils/chatSegments'

export function parseTurnState(raw?: string | null): TurnEntry[] {
    if (!raw) return []
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return []
    }
    if (!parsed || typeof parsed !== 'object') return []
    const obj = parsed as { turns?: unknown; legacy?: { turns?: unknown } }
    const turns = Array.isArray(obj.turns)
        ? obj.turns
        : Array.isArray(obj.legacy?.turns)
          ? obj.legacy!.turns
          : []
    return (turns as TurnEntry[]).map(sanitizeTurn)
}

function sanitizeTurn(turn: TurnEntry): TurnEntry {
    const assets = safeAssets(turn.imageAssets)
    const ttsAssets = safeTtsAssets(turn.ttsAssets)
    const segments = safeResponseSegments(turn.segments)
    return {
        ...turn,
        segments: segments.length > 0 ? segments : undefined,
        assistantMessageId: typeof turn.assistantMessageId === 'number' ? turn.assistantMessageId : numberFromUnknown(turn.assistantMessageId),
        turnId: typeof turn.turnId === 'string' ? turn.turnId : undefined,
        imageStatus: isImageStatus(turn.imageStatus) ? turn.imageStatus : undefined,
        imageStatusUrl: safeRoute(turn.imageStatusUrl, '/images/jobs/'),
        imageResultUrl: safeRoute(turn.imageResultUrl, '/images/jobs/'),
        imageAssets: assets.length > 0 ? assets : undefined,
        imageUrl: assets[0]?.url ?? safeAssetUrl(turn.imageUrl),
        imageError: safeError(turn.imageError),
        ttsStatus: isTtsStatus(turn.ttsStatus) ? turn.ttsStatus : undefined,
        ttsStatusUrl: safeRoute(turn.ttsStatusUrl, '/tts/jobs/'),
        ttsResultUrl: safeRoute(turn.ttsResultUrl, '/tts/jobs/'),
        ttsAssets: ttsAssets.length > 0 ? ttsAssets : undefined,
        ttsUrl: ttsAssets[0]?.url ?? safeTtsAudioUrl(turn.ttsUrl),
        ttsError: safeTtsError(turn.ttsError),
        ttsSegments: safeTtsSegments(turn.ttsSegments),
    }
}

function safeTtsSegments(value: unknown): ChatTtsSegmentClip[] | undefined {
    if (!Array.isArray(value)) return undefined
    const clips: ChatTtsSegmentClip[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object') continue
        const raw = item as ChatTtsSegmentClip
        if (typeof raw.segment_index !== 'number') continue
        const assets = safeTtsAssets(raw.assets)
        clips.push({
            segment_index: raw.segment_index,
            segment_count: typeof raw.segment_count === 'number' ? raw.segment_count : undefined,
            kind: raw.kind === 'narrator' || raw.kind === 'speech' || raw.kind === 'thought' ? raw.kind : undefined,
            speaker_id: typeof raw.speaker_id === 'string' ? raw.speaker_id : null,
            speaker_name: typeof raw.speaker_name === 'string' ? raw.speaker_name : null,
            job_id: typeof raw.job_id === 'string' ? raw.job_id : undefined,
            status: isTtsStatus(raw.status) ? raw.status : undefined,
            status_url: safeRoute(raw.status_url, '/tts/jobs/'),
            result_url: safeRoute(raw.result_url, '/tts/jobs/'),
            assets: assets.length > 0 ? assets : undefined,
            url: assets[0]?.url ?? safeTtsAudioUrl(raw.url),
            error: safeTtsError(raw.error),
        })
    }
    if (clips.length === 0) return undefined
    clips.sort((a, b) => a.segment_index - b.segment_index)
    return clips
}

function safeAssets(value: unknown): ChatImageAsset[] {
    if (!Array.isArray(value)) return []
    return value.filter((asset): asset is ChatImageAsset => {
        if (!asset || typeof asset !== 'object') return false
        const candidate = asset as ChatImageAsset
        return typeof candidate.asset_id === 'string' && safeAssetUrl(candidate.url) !== undefined && ['image/jpeg', 'image/png', 'image/webp'].includes(candidate.content_type)
    }).map((asset) => ({ ...asset, url: safeAssetUrl(asset.url)! }))
}

function safeError(value: unknown): ChatImageError | undefined {
    if (!value || typeof value !== 'object') return undefined
    const error = value as ChatImageError
    return {
        category: safeText(error.category, 'failed'),
        detail: safeText(error.detail, 'Image generation failed.'),
        code: error.code ? safeText(error.code, '') || undefined : undefined,
    }
}

function safeTtsAssets(value: unknown): ChatTtsAsset[] {
    if (!Array.isArray(value)) return []
    return value.filter((asset): asset is ChatTtsAsset => {
        if (!asset || typeof asset !== 'object') return false
        const candidate = asset as ChatTtsAsset
        return typeof candidate.asset_id === 'string' && safeTtsAudioUrl(candidate.url) !== undefined && candidate.content_type === 'audio/mpeg'
    }).map((asset) => ({ ...asset, url: safeTtsAudioUrl(asset.url)! }))
}

function safeTtsError(value: unknown): ChatTtsError | undefined {
    if (!value || typeof value !== 'object') return undefined
    const error = value as ChatTtsError
    const retry = typeof error.retry_after_seconds === 'number' && Number.isFinite(error.retry_after_seconds) && error.retry_after_seconds >= 0
        ? error.retry_after_seconds
        : undefined
    return {
        category: safeText(error.category, 'failed'),
        detail: safeText(error.detail, 'Narration failed.'),
        code: error.code ? safeText(error.code, '') || undefined : undefined,
        retry_after_seconds: retry,
    }
}

function isImageStatus(value: unknown): value is ImageLifecycleStatus {
    return typeof value === 'string' && ['pending', 'in_progress', 'mirroring', 'completed', 'failed', 'canceled', 'unavailable', 'invalid', 'quota_exceeded'].includes(value)
}

function isTtsStatus(value: unknown): value is TtsLifecycleStatus {
    return typeof value === 'string' && ['pending', 'in_progress', 'synthesizing', 'mirroring', 'completed', 'failed', 'invalid', 'unavailable', 'quota_exceeded', 'rate_limited', 'timeout', 'content_blocked'].includes(value)
}

function numberFromUnknown(value: unknown): number | undefined {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function safeRoute(value: unknown, prefix: string): string | undefined {
    return typeof value === 'string' && value.startsWith(prefix) ? value : undefined
}

function safeAssetUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const text = value.trim()
    const lowered = text.toLowerCase()
    if (!text || lowered.startsWith('data:') || lowered.includes('fal.media') || lowered.includes('signature=') || lowered.includes('x-amz-signature') || lowered.includes('/var/') || lowered.includes('/tmp/')) return undefined
    if (text.startsWith('/')) return text.startsWith('//') ? undefined : text
    return lowered.startsWith('http://') || lowered.startsWith('https://') ? text : undefined
}

// Narration audio must be the backend's ownership-checked download route; stale
// pre-route `/generated-tts/` static URLs are dropped so the speaker control
// falls back to re-requesting narration (mirrors chatTtsTurnState.isSafeTtsAudioUrl).
function safeTtsAudioUrl(value: unknown): string | undefined {
    const text = safeAssetUrl(value)
    if (!text) return undefined
    const path = text.replace(/^https?:\/\/[^/]+/i, '')
    const normalized = path.split('?')[0].split('#')[0].toLowerCase()
    return normalized.startsWith('/tts/assets/') && normalized.endsWith('.mp3') ? text : undefined
}

function safeText(value: unknown, fallback: string): string {
    const text = String(value || '').trim()
    const lowered = text.toLowerCase()
    if (!text || lowered.includes('http://') || lowered.includes('https://') || lowered.includes('/var/') || lowered.includes('/tmp/') || lowered.includes('secret') || lowered.includes('bearer ') || lowered.includes('authorization')) return fallback
    return text
}
