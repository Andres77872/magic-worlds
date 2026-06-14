/**
 * Adapters between the raw call-history API rows and the call UI. Kept as the single
 * place display/shape decisions live so a backend serializer change is a one-file edit.
 */

import type { TFunction } from 'i18next'
import { resolveMediaUrl } from '@/infrastructure/api'
import type { CallSummary, CallTranscriptSegment, Character } from '@/shared'
import { formatRelativeTime } from '@/utils/time'

export interface CallDisplay {
    name: string
    imageUrl?: string
}

/**
 * Resolve a call's character name + portrait. Prefers the snapshot fields the backend
 * returns, falling back to the user's loaded library character (matched by id) so a call
 * still renders an identity when the snapshot lacks them.
 */
export function callDisplay(call: CallSummary, characters: Character[] = [], t: TFunction): CallDisplay {
    const match = call.character_card_id
        ? characters.find((character) => character.id === call.character_card_id)
        : undefined
    const fallback = t('call.transforms.unknownCharacter')
    const name = (call.character_name || match?.name || fallback).trim() || fallback
    const rawImage = call.character_image_url || match?.image_url
    return { name, imageUrl: rawImage ? resolveMediaUrl(rawImage) : undefined }
}

/** "3m 20s" style duration, or null when unknown. */
export function formatCallDuration(seconds?: number | null): string | null {
    if (seconds == null || seconds <= 0) return null
    const total = Math.floor(seconds)
    const minutes = Math.floor(total / 60)
    const remainder = total % 60
    if (minutes <= 0) return `${remainder}s`
    return `${minutes}m ${String(remainder).padStart(2, '0')}s`
}

/** Relative "2 hours ago" for a call, preferring its start time. */
export function formatCallTime(call: CallSummary, now: number = Date.now()): string {
    return formatRelativeTime(call.started_at ?? call.ended_at, now)
}

/** A short one-line meta string for a call tile/row. */
export function callMetaLine(call: CallSummary, t: TFunction): string {
    const parts: string[] = []
    const duration = formatCallDuration(call.duration_seconds)
    if (duration) parts.push(duration)
    if (typeof call.segment_count === 'number' && call.segment_count > 0) {
        parts.push(t('call.transforms.lines', { count: call.segment_count }))
    }
    return parts.join(' · ')
}

export function isAssistantLine(segment: CallTranscriptSegment): boolean {
    return segment.role === 'assistant'
}
