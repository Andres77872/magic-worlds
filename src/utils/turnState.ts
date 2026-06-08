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

import type { ChatImageAsset, ChatImageError, ImageLifecycleStatus, TurnEntry } from '@/shared'

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
    return {
        ...turn,
        assistantMessageId: typeof turn.assistantMessageId === 'number' ? turn.assistantMessageId : numberFromUnknown(turn.assistantMessageId),
        turnId: typeof turn.turnId === 'string' ? turn.turnId : undefined,
        imageStatus: isImageStatus(turn.imageStatus) ? turn.imageStatus : undefined,
        imageStatusUrl: safeRoute(turn.imageStatusUrl),
        imageResultUrl: safeRoute(turn.imageResultUrl),
        imageAssets: assets.length > 0 ? assets : undefined,
        imageUrl: assets[0]?.url ?? safeAssetUrl(turn.imageUrl),
        imageError: safeError(turn.imageError),
    }
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

function isImageStatus(value: unknown): value is ImageLifecycleStatus {
    return typeof value === 'string' && ['pending', 'in_progress', 'mirroring', 'completed', 'failed', 'canceled', 'unavailable', 'invalid', 'quota_exceeded'].includes(value)
}

function numberFromUnknown(value: unknown): number | undefined {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function safeRoute(value: unknown): string | undefined {
    return typeof value === 'string' && value.startsWith('/images/jobs/') ? value : undefined
}

function safeAssetUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const text = value.trim()
    const lowered = text.toLowerCase()
    if (!text || lowered.startsWith('data:') || lowered.includes('fal.media') || lowered.includes('signature=') || lowered.includes('x-amz-signature') || lowered.includes('/var/') || lowered.includes('/tmp/')) return undefined
    if (text.startsWith('/')) return text.startsWith('//') ? undefined : text
    return lowered.startsWith('http://') || lowered.startsWith('https://') ? text : undefined
}

function safeText(value: unknown, fallback: string): string {
    const text = String(value || '').trim()
    const lowered = text.toLowerCase()
    if (!text || lowered.includes('http://') || lowered.includes('https://') || lowered.includes('/var/') || lowered.includes('/tmp/') || lowered.includes('secret') || lowered.includes('bearer ') || lowered.includes('authorization')) return fallback
    return text
}
