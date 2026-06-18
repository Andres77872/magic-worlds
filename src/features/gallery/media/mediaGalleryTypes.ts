/**
 * Media gallery domain — a unified, filterable view over the user's generated
 * media: images (user-wide `GET /images/jobs`, optionally card-tagged) and theme
 * songs (`GET /theme-songs/user`, always card-scoped). Jobs flatten into
 * asset-level items so the grid, lightbox, and deletes all operate on assets.
 */

import type { CardMediaTargetType, ImageJobPublic, ThemeSongJobPublic } from '@/shared'
import type { TFunction } from 'i18next'
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
    /** Exact prompt recorded by the backend for this generated image, when available. */
    prompt?: string
    /** Saved generation model alias; intentionally not rendered in the media gallery. */
    modelAlias?: string
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
        const prompt = job.generation_prompt?.trim() || undefined
        out.push({
            kind: 'image',
            id: asset.asset_id,
            jobId: job.job_id,
            createdAt: job.created_at,
            card,
            url,
            prompt,
            modelAlias: job.model_alias?.trim() || undefined,
        })
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

/** Empty-state copy keyed off the active filter combination. */
export function emptyCopy(filters: MediaGalleryFilters, t: TFunction): { title: string; description: string } {
    const nounKey =
        filters.mediaType === 'images' ? 'Images' : filters.mediaType === 'themes' ? 'Themes' : 'Media'
    const filtered = Boolean(filters.card) || filters.cardType !== 'all' || filters.mediaType !== 'all'
    if (filters.card?.name) {
        return {
            title: t(`mediaGallery.empty.no${nounKey}ForCard`, { name: filters.card.name }),
            description: t('mediaGallery.empty.filteredDescription'),
        }
    }
    if (filters.card) {
        return {
            title: t(`mediaGallery.empty.no${nounKey}ForThatCard`),
            description: t('mediaGallery.empty.filteredDescription'),
        }
    }
    if (filters.cardType !== 'all') {
        return {
            title: t(`mediaGallery.empty.no${nounKey}ForType`, {
                type: t(`mediaGallery.empty.type.${filters.cardType}`),
            }),
            description: t('mediaGallery.empty.filteredDescription'),
        }
    }
    return {
        title: t(`mediaGallery.empty.no${nounKey}`),
        description: filtered
            ? t('mediaGallery.empty.filteredDescription')
            : t('mediaGallery.empty.defaultDescription'),
    }
}
