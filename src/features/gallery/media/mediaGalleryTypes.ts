/**
 * Media gallery domain — a unified, filterable view over the user's generated
 * media: images (user-wide `GET /images/jobs`, optionally card-tagged) and theme
 * songs (`GET /theme-songs/user`, always card-scoped). Jobs flatten into
 * asset-level items so the grid, lightbox, and deletes all operate on assets.
 */

import type { CardMediaTargetType, ImageJobPublic, ThemeSongJobPublic } from '@/shared'
import { resolveMediaUrl } from '@/infrastructure/api'
import { dateFromApiTimestamp } from '@/utils/time'

export type MediaTypeFilter = 'all' | 'images' | 'themes'
export type CardTypeFilter = CardMediaTargetType | 'all'

/** A card the media belongs to (loose tag — the card may have been deleted). */
export interface CardRef {
    type: CardMediaTargetType
    id: string
    name?: string
}

export interface MediaGalleryFilters {
    mediaType: MediaTypeFilter
    cardType: CardTypeFilter
    /** Specific-card filter; presence implies `cardType === card.type`. */
    card?: CardRef
}

interface MediaItemBase {
    /** asset_id — stable grid key and the delete handle. */
    id: string
    jobId: string
    /** Job `created_at` — the newest-first merge key across both sources. */
    createdAt: string
    /** Card tag; absent for legacy/untagged images. */
    card?: CardRef
}

export interface MediaImageItem extends MediaItemBase {
    kind: 'image'
    /** Resolved (absolute) image URL. */
    url: string
}

export interface MediaThemeItem extends MediaItemBase {
    kind: 'theme'
    /** Resolved (absolute) audio URL. */
    url: string
    title: string
    styleTags: string[]
    durationMs?: number | null
    /** Download extension. */
    outputFormat: 'mp3' | 'wav'
}

export type MediaGalleryItem = MediaImageItem | MediaThemeItem

export function formatWhen(iso?: string): string {
    const dateValue = dateFromApiTimestamp(iso)
    if (!dateValue) return ''
    const date = dateValue.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const time = dateValue.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${date} · ${time}`
}

export function formatDuration(ms?: number | null): string {
    if (!ms || ms <= 0) return ''
    const totalSeconds = Math.round(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** One grid item per renderable asset (image jobs can carry several). */
export function imageJobToItems(job: ImageJobPublic): MediaImageItem[] {
    const card: CardRef | undefined =
        job.card_type && job.card_id
            ? { type: job.card_type, id: job.card_id, name: job.card_name ?? undefined }
            : undefined
    const out: MediaImageItem[] = []
    for (const asset of job.assets ?? []) {
        const url = resolveMediaUrl(asset?.url)
        if (!asset?.asset_id || !url) continue
        out.push({ kind: 'image', id: asset.asset_id, jobId: job.job_id, createdAt: job.created_at, card, url })
    }
    return out
}

/** First playable asset wins (theme jobs produce one track). */
export function themeJobToItem(job: ThemeSongJobPublic): MediaThemeItem | null {
    const asset = job.assets?.find((a) => a?.asset_id && a?.url)
    const url = resolveMediaUrl(asset?.url)
    if (!asset || !url) return null
    return {
        kind: 'theme',
        id: asset.asset_id,
        jobId: job.job_id,
        createdAt: job.created_at,
        card: { type: job.target.type, id: job.target.id, name: job.target.display_name ?? undefined },
        url,
        title: job.lyrics?.song_title?.trim() || `Theme · ${formatWhen(job.created_at)}`,
        styleTags: job.lyrics?.style_tags ?? [],
        durationMs: asset.duration_ms,
        outputFormat: asset.output_format ?? (asset.content_type.includes('wav') ? 'wav' : 'mp3'),
    }
}

const CARD_TYPE_PLURAL: Record<CardMediaTargetType, string> = {
    character: 'characters',
    world: 'worlds',
    item: 'items',
    adventure_template: 'adventures',
}

/** Empty-state copy keyed off the active filter combination. */
export function emptyCopy(filters: MediaGalleryFilters): { title: string; description: string } {
    const noun =
        filters.mediaType === 'images' ? 'images' : filters.mediaType === 'themes' ? 'themes' : 'media'
    const scope = filters.card?.name
        ? `for ${filters.card.name}`
        : filters.card
          ? 'for that card'
          : filters.cardType !== 'all'
            ? `for your ${CARD_TYPE_PLURAL[filters.cardType]}`
            : ''
    const filtered = Boolean(scope) || filters.mediaType !== 'all'
    return {
        title: scope ? `No ${noun} ${scope} yet` : `No ${noun} yet`,
        description: filtered
            ? 'Try widening the filters, or conjure something new from a card’s studio.'
            : 'Generate a portrait or compose a theme from any card’s studio and it will gather here.',
    }
}
